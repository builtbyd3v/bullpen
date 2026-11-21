import { FAKE_CHECKS, FAKE_HOOKS, FAKE_STATE, fakeAsk, fakeDiff, fakeOrchestrate, fakeServer } from "./fake.ts";
import type { Store } from "./store.ts";
import type { Action, BullpenState, Envelope, Plan } from "./types.ts";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:8600";
const ORCHESTRATOR_URL = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:8650";
const TYPES = new Set(["hook", "state", "commit", "undo", "merge", "check", "plan"]);

export const isFake = () => new URLSearchParams(window.location.search).has("fake");

// The server still sends some bare hook bodies (events.md section 4 TODO); drop anything without a known type.
function isState(data: unknown): data is BullpenState {
  if (typeof data !== "object" || data === null) return false;
  const d = data as { worktrees?: unknown; approvals?: unknown };
  return Array.isArray(d.worktrees) && Array.isArray(d.approvals);
}

function isEnvelope(msg: unknown): msg is Envelope {
  return typeof msg === "object" && msg !== null && "type" in msg && TYPES.has(String(msg.type));
}

async function fetchJson(url: string, timeoutMs = 2500): Promise<Record<string, unknown> | null> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as unknown;
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export function connect(store: Store): () => void {
  if (isFake()) {
    store.dispatch({ type: "state", data: FAKE_STATE });
    [...FAKE_CHECKS].reverse().forEach((c) => store.dispatch({ type: "check", data: c }));
    [...FAKE_HOOKS].reverse().forEach((h) => store.dispatch({ type: "hook", data: h }));
    store.setHealth({ server: "ok", ws: "ok", orchestrator: "ok" });
    return () => {};
  }

  let closed = false;
  let ws: WebSocket | undefined;
  // Jetson status comes from `check` events (the browser cannot reach the Jetson: no CORS there).
  const pollHealth = async () => {
    const [serverBody, orchBody] = await Promise.all([
      fetchJson(`${SERVER_URL.replace(/\/$/, "")}/health`),
      fetchJson(`${ORCHESTRATOR_URL.replace(/\/$/, "")}/health`),
    ]);
    if (closed) return;
    store.setHealth({
      server: serverBody && serverBody.ok !== false ? "ok" : "down",
      orchestrator: orchBody && orchBody.ok !== false ? "ok" : "down",
    });
  };

  void pollHealth();
  const healthTimer = window.setInterval(() => void pollHealth(), 5000);

  const open = () => {
    ws = new WebSocket(`${SERVER_URL.replace(/^http/, "ws")}/ws`);
    // Refetch on every (re)connect so a restarted server or a missed message cannot leave stale state.
    ws.onopen = () => {
      store.setHealth({ ws: "ok" });
      fetch(`${SERVER_URL}/state`)
        .then((r) => r.json() as Promise<unknown>)
        .then((data) => closed || dispatch({ type: "state", data }))
        .catch((e: unknown) => console.warn("[bullpen] /state failed", e));
    };
    ws.onmessage = (m: MessageEvent<string>) => {
      try {
        dispatch(JSON.parse(m.data));
      } catch (e) {
        console.warn("[bullpen] bad ws message", e);
      }
    };
    ws.onerror = () => {
      if (!closed) store.setHealth({ ws: "down" });
    };
    ws.onclose = () => {
      if (closed) return;
      store.setHealth({ ws: "down" });
      setTimeout(open, 1000);
    };
  };
  const dispatch = (msg: unknown) => {
    if (!isEnvelope(msg)) return;
    if (msg.type === "state" && !isState(msg.data)) return console.warn("[bullpen] bad state", msg.data);
    store.dispatch(msg);
  };
  open();
  return () => {
    closed = true;
    window.clearInterval(healthTimer);
    ws?.close();
  };
}

export function triggerReplay(store: Store): void {
  if (isFake()) {
    const currentlyReplaying = store.getState().replaying;
    store.dispatch({ type: "state", data: store.getState().data, replay: !currentlyReplaying });
    return;
  }
  fetch(`${SERVER_URL.replace(/\/$/, "")}/replay`).catch((e: unknown) =>
    console.warn("[bullpen] GET /replay failed", e),
  );
}

export function act(store: Store, action: Action): void {
  if (isFake()) {
    fakeServer(action).forEach((e) => store.dispatch(e));
    return;
  }
  const path = action.kind === "approve" ? `/approve/${action.id}` : `/${action.kind}/${action.agent}`;
  fetch(`${SERVER_URL}${path}`, {
    method: "POST",
    ...(action.kind === "approve" && {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: action.decision }),
    }),
  }).catch((e: unknown) => console.warn(`[bullpen] POST ${path} failed`, e));
}

export async function orchestrate(store: Store, ask: string): Promise<Plan> {
  if (isFake()) {
    const plan = fakeOrchestrate(ask);
    store.dispatch({ type: "plan", data: plan });
    return plan;
  }
  const res = await fetch(`${ORCHESTRATOR_URL.replace(/\/$/, "")}/orchestrate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ask }),
  });
  const body = (await res.json().catch(() => ({}))) as Partial<Plan> & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Orchestrator returned HTTP ${res.status}`);
  const plan: Plan = {
    ask: body.ask ?? ask,
    tasks: Array.isArray(body.tasks) ? body.tasks : [],
    source: body.source,
    started: body.started,
  };
  store.dispatch({ type: "plan", data: plan });
  return plan;
}

export async function askWhy(question: string): Promise<string> {
  if (isFake()) return fakeAsk(question);
  const res = await fetch(`${ORCHESTRATOR_URL.replace(/\/$/, "")}/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
  const body = (await res.json().catch(() => ({}))) as { answer?: string; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Ask failed (HTTP ${res.status})`);
  if (typeof body.answer !== "string") throw new Error("Invalid answer from orchestrator");
  return body.answer;
}

export async function fetchDiff(agent: string, file: string): Promise<string> {
  if (isFake()) return fakeDiff(agent, file);
  const params = new URLSearchParams({ agent, file });
  const res = await fetch(`${SERVER_URL.replace(/\/$/, "")}/diff?${params.toString()}`);
  if (!res.ok) throw new Error(`GET /diff failed (HTTP ${res.status})`);
  const body = (await res.json()) as { diff?: string };
  return typeof body.diff === "string" ? body.diff : "";
}
