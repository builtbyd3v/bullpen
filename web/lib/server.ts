import { FAKE_STATE, fakeServer } from "./fake.ts";
import type { Store } from "./store.ts";
import type { Action, BullpenState, Envelope } from "./types.ts";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:8600";
const TYPES = new Set(["hook", "state", "commit", "undo", "merge"]);

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

export function connect(store: Store): () => void {
  if (isFake()) {
    store.dispatch({ type: "state", data: FAKE_STATE });
    return () => {};
  }
  let closed = false;
  let ws: WebSocket | undefined;
  const open = () => {
    ws = new WebSocket(`${SERVER_URL.replace(/^http/, "ws")}/ws`);
    // Refetch on every (re)connect so a restarted server or a missed message cannot leave stale state.
    ws.onopen = () =>
      fetch(`${SERVER_URL}/state`)
        .then((r) => r.json() as Promise<unknown>)
        .then((data) => closed || dispatch({ type: "state", data }))
        .catch((e: unknown) => console.warn("[bullpen] /state failed", e));
    ws.onmessage = (m: MessageEvent<string>) => {
      try {
        dispatch(JSON.parse(m.data));
      } catch (e) {
        console.warn("[bullpen] bad ws message", e);
      }
    };
    ws.onclose = () => closed || setTimeout(open, 1000);
  };
  const dispatch = (msg: unknown) => {
    if (!isEnvelope(msg)) return;
    if (msg.type === "state" && !isState(msg.data)) return console.warn("[bullpen] bad state", msg.data);
    store.dispatch(msg);
  };
  open();
  return () => {
    closed = true;
    ws?.close();
  };
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
