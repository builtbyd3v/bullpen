import { FAKE_CHECKS, FAKE_HOOKS, FAKE_STATE, fakeAsk, fakeDiff, fakeOrchestrate, fakeServer } from "./fake.ts";
import type { Store } from "./store.ts";
import type { Action, BullpenState, Envelope, Plan } from "./types.ts";

export const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:8600";
const ORCHESTRATOR_URL = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:8650";
// Section 4 types the UI uses. Anything else is dropped (clients ignore unknown types).
const TYPES = new Set([
  "hook",
  "state",
  "claim_granted",
  "claim_wait",
  "claim_released",
  "approval_needed",
  "approved",
  "denied",
  "check",
  "commit",
  "undo",
  "merge",
  "plan",
  "secret_blocked",
]);

export const isFake = () => new URLSearchParams(window.location.search).has("fake");

function isState(data: unknown): data is BullpenState {
  if (typeof data !== "object" || data === null) return false;
  const d = data as { worktrees?: unknown; approvals?: unknown };
  return Array.isArray(d.worktrees) && Array.isArray(d.approvals);
}

function isEnvelope(msg: unknown): msg is Envelope {
  return typeof msg === "object" && msg !== null && "type" in msg && TYPES.has(String(msg.type));
}

export function connect(store: Store): () => void {
  if (isFake()) {
    store.dispatch({ type: "state", data: FAKE_STATE });
    [...FAKE_CHECKS].reverse().forEach((c) => store.dispatch({ type: "check", data: c }));
    [...FAKE_HOOKS].reverse().forEach((h) => store.dispatch({ type: "hook", data: h }));
    return () => {};
  }
  let closed = false;
  let ws: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const loadState = () =>
    fetch(`${SERVER_URL}/state`)
      .then((r) => r.json() as Promise<unknown>)
      .then((data) => closed || dispatch({ type: "state", data }))
      .catch((e: unknown) => console.warn("[bullpen] /state failed", e));
  const open = () => {
    // /state loads on its own too, so the campus fills even if the socket cannot connect.
    loadState();
    ws = new WebSocket(`${SERVER_URL.replace(/^http/, "ws")}/ws`);
    // Refetch once the socket is up, so nothing sent between the fetch and the connect is missed.
    ws.onopen = () => {
      store.setUi({ conn: "live" });
      loadState();
    };
    ws.onmessage = (m: MessageEvent<string>) => {
      try {
        dispatch(JSON.parse(m.data));
      } catch (e) {
        console.warn("[bullpen] bad ws message", e);
      }
    };
    ws.onclose = () => {
      if (closed) return;
      store.setUi({ conn: "offline" });
      retry = setTimeout(open, 1500);
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
    clearTimeout(retry);
    ws?.close();
  };
}

export function act(store: Store, action: Action): void {
  if (isFake()) {
    fakeServer(action).forEach((e) => store.dispatch(e));
    return;
  }
  const path = action.kind === "approve" ? `/approve/${action.id}` : `/${action.kind}/${action.agent}`;
  const label = action.kind === "approve" ? `${action.decision === "allow" ? "Approve" : "Deny"} ${action.id}` : `${action.kind[0].toUpperCase()}${action.kind.slice(1)} ${action.agent}`;
  fetch(`${SERVER_URL}${path}`, {
    method: "POST",
    ...(action.kind === "approve" && {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: action.decision }),
    }),
  })
    .then(async (r) => {
      if (r.ok) return;
      // FastAPI errors are {"detail": str}; a 409 on merge is a conflict the user should see.
      const body = (await r.json().catch(() => ({}))) as { detail?: unknown };
      store.notify(`${label} failed: ${typeof body.detail === "string" ? body.detail : `HTTP ${r.status}`}`);
    })
    .catch(() => store.notify(`${label} failed: server offline`));
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
