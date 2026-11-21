import { FAKE_STATE, fakeServer } from "./fake.ts";
import type { Store } from "./store.ts";
import type { Action, BullpenState, Envelope } from "./types.ts";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:8600";
const TYPES = new Set(["hook", "state", "commit", "undo", "merge"]);

const isFake = () => new URLSearchParams(window.location.search).has("fake");

// The server still sends some bare hook bodies (events.md section 4 TODO); drop anything without a known type.
function isEnvelope(msg: unknown): msg is Envelope {
  return typeof msg === "object" && msg !== null && "type" in msg && TYPES.has(String(msg.type));
}

export function connect(store: Store): () => void {
  if (isFake()) {
    store.dispatch({ type: "state", data: FAKE_STATE });
    return () => {};
  }
  let closed = false;
  fetch(`${SERVER_URL}/state`)
    .then((r) => r.json() as Promise<BullpenState>)
    .then((data) => closed || store.dispatch({ type: "state", data }))
    .catch((e: unknown) => console.warn("[bullpen] /state failed", e));
  const ws = new WebSocket(`${SERVER_URL.replace(/^http/, "ws")}/ws`);
  ws.onmessage = (m: MessageEvent<string>) => {
    const msg: unknown = JSON.parse(m.data);
    if (isEnvelope(msg)) store.dispatch(msg);
  };
  return () => {
    closed = true;
    ws.close();
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
    headers: { "content-type": "application/json" },
    body: action.kind === "approve" ? JSON.stringify({ decision: action.decision }) : undefined,
  }).catch((e: unknown) => console.warn(`[bullpen] POST ${path} failed`, e));
}
