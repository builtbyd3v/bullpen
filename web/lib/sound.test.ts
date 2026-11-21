import { test } from "node:test";
import assert from "node:assert/strict";
import { createSfx, soundFor, type Sound } from "./sound.ts";
import type { CheckEvent, Envelope } from "./types.ts";

const check = (decision: CheckEvent["decision"], rule: string): Envelope => ({
  type: "check",
  data: { agent: "api", tool: "Edit", file: "api/x.ts", decision, rule, latency_ms: 1, model: "rules", at: "" },
});

test("each source-control event maps to its one sound", () => {
  const cases: [Envelope, Sound | null][] = [
    [{ type: "claim_granted", data: { agent: "api", file: "a", building: "enb", expires_at: "" } }, "claim"],
    [{ type: "claim_wait", data: { agent: "web", file: "a", building: "enb", holder: "api" } }, "wait"],
    [{ type: "commit", data: { agent: "api", sha: "1", message: "m", files: [] } }, "commit"],
    [{ type: "undo", data: { agent: "api" } }, "undo"],
    [{ type: "merge", data: { agent: "api", sha: "1" } }, "merge"],
    [{ type: "denied", data: { id: "1", agent: "db", text: "" } }, "blocked"],
    [check("deny", "db/**"), "blocked"],
    [check("deny", "offline"), "offline"],
    [check("allow", "default"), null],
    [check("ask", "db/**"), null],
    [{ type: "plan", data: { ask: "x", tasks: [] } }, null],
  ];
  for (const [e, want] of cases) assert.equal(soundFor(e), want, e.type);
});

test("the player is called once per live event, never for replays, and bursts are rate-limited", () => {
  const played: Sound[] = [];
  let t = 0;
  const sfx = createSfx((s) => played.push(s), () => t);
  const undo: Envelope = { type: "undo", data: { agent: "api" } };
  sfx({ ...undo, replay: true });
  assert.deepEqual(played, []);
  sfx(undo);
  sfx(undo);
  assert.deepEqual(played, ["undo"]);
  t = 400;
  sfx(undo);
  sfx({ type: "merge", data: { agent: "api", sha: "1" } });
  assert.deepEqual(played, ["undo", "undo", "merge"]);
});

test("important events map to notices; approvals close on an answer", async () => {
  const { noticesFor, closesNotice } = await import("./sound.ts");
  const kinds = (e: Envelope, prev?: Record<string, string>) => noticesFor(e, prev).map((n) => n.kind);
  assert.deepEqual(kinds({ type: "approval_needed", data: { id: "a1", agent: "db", tool: "Edit", target: "db/s.sql", reason: "" } }), ["approval"]);
  assert.equal(noticesFor({ type: "approval_needed", data: { id: "a1", agent: "db", tool: "Edit", target: "db/s.sql", reason: "" } })[0].approvalId, "a1");
  assert.deepEqual(kinds(check("deny", "db/**")), ["blocked"]);
  assert.deepEqual(kinds({ type: "denied", data: { id: "a1", agent: "db", text: "" } }), ["blocked"]);
  assert.deepEqual(kinds(check("deny", "offline")), ["offline"]);
  assert.deepEqual(kinds(check("allow", "default")), []);
  assert.deepEqual(kinds({ type: "claim_wait", data: { agent: "web", file: "a", building: "enb", holder: "api" } }), ["wait"]);
  assert.deepEqual(kinds({ type: "merge", data: { agent: "api", sha: "1" } }), ["merge"]);
  assert.deepEqual(kinds({ type: "hook", data: { agent: "api", event: "Stop" } }), ["done"]);
  assert.deepEqual(kinds({ type: "commit", data: { agent: "api", sha: "1", message: "m", files: [] } }), []);
  const w = { agent: "api", color: "", branch: "", path: "", task: "", changed_files: [], ahead: 0, claims: [], building: "", commits: [] };
  const state = (status: "working" | "done"): Envelope => ({ type: "state", data: { main: "main", approvals: [], worktrees: [{ ...w, status }] } });
  assert.deepEqual(kinds(state("done"), { api: "working" }), ["done"]);
  assert.deepEqual(kinds(state("done"), { api: "done" }), []);
  assert.deepEqual(kinds(state("done")), []);
  assert.equal(closesNotice({ type: "approved", data: { id: "a1", agent: "db" } }), "approval:a1");
  assert.equal(closesNotice({ type: "undo", data: { agent: "db" } }), null);
});
