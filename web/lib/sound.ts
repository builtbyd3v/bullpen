import type { Envelope } from "./types.ts";

export type Sound = "claim" | "wait" | "commit" | "undo" | "merge" | "blocked" | "offline";

// One sound per source-control event, the same mapping the campus visuals use.
export function soundFor(e: Envelope): Sound | null {
  switch (e.type) {
    case "claim_granted":
      return "claim";
    case "claim_wait":
      return "wait";
    case "commit":
      return "commit";
    case "undo":
      return "undo";
    case "merge":
      return "merge";
    case "denied":
      return "blocked";
    case "check":
      if (e.data.rule === "offline") return "offline";
      return e.data.decision === "deny" ? "blocked" : null;
    default:
      return null;
  }
}

// Replayed envelopes stay silent, and one sound plays at most once per `gapMs`, so a burst is one blip, not a wall of noise.
export function createSfx(play: (s: Sound) => void, now: () => number = Date.now, gapMs = 300) {
  const last = new Map<Sound, number>();
  return (e: Envelope) => {
    if (e.replay) return;
    const s = soundFor(e);
    if (!s) return;
    const t = now();
    if (t - (last.get(s) ?? -Infinity) < gapMs) return;
    last.set(s, t);
    play(s);
  };
}

export type NoticeKind = "approval" | "blocked" | "wait" | "done" | "merge" | "offline";
// `key` dedupes: the same wait or approval never toasts twice.
export type Notice = { key: string; kind: NoticeKind; text: string; approvalId?: string };

// Important events that also get a chime, a toast, and (tab in the background) a browser notification.
// `prev` is each agent's status before this envelope, so a `state` that flips an agent to done reads as "task done".
export function noticesFor(e: Envelope, prev: Record<string, string> = {}): Notice[] {
  switch (e.type) {
    case "approval_needed":
      return [{ key: `approval:${e.data.id}`, kind: "approval", text: `${e.data.agent} needs approval to edit ${e.data.target}`, approvalId: e.data.id }];
    case "denied":
      return [{ key: `blocked:${e.data.agent}:${e.data.id}`, kind: "blocked", text: `${e.data.agent} was blocked` }];
    case "check":
      if (e.data.rule === "offline") return [{ key: "offline", kind: "offline", text: "Jetson offline: every edit is blocked" }];
      if (e.data.decision !== "deny") return [];
      return [{ key: `blocked:${e.data.agent}:${e.data.file}:${e.data.at}`, kind: "blocked", text: `${e.data.agent} blocked by the referee on ${e.data.file}` }];
    case "claim_wait":
      return [{ key: `wait:${e.data.agent}:${e.data.file}`, kind: "wait", text: `${e.data.agent} waiting for ${e.data.file} (${e.data.holder} is editing)` }];
    case "merge":
      return [{ key: `merge:${e.data.agent}:${e.data.sha}`, kind: "merge", text: `${e.data.agent} merged to main` }];
    case "hook": {
      const agent = typeof e.data.agent === "string" ? e.data.agent : "";
      const event = e.data.event ?? e.data.hook_event_name;
      return agent && event === "Stop" ? [{ key: `done:${agent}`, kind: "done", text: `${agent} finished its task` }] : [];
    }
    case "state":
      return e.data.worktrees
        .filter((w) => w.status === "done" && prev[w.agent] !== undefined && prev[w.agent] !== "done")
        .map((w) => ({ key: `done:${w.agent}`, kind: "done" as const, text: `${w.agent} finished its task` }));
    default:
      return [];
  }
}

// The approval toast closes once the approval is answered.
export const closesNotice = (e: Envelope): string | null =>
  e.type === "approved" || e.type === "denied" ? `approval:${e.data.id}` : null;
