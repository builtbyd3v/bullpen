import { test } from "node:test";
import assert from "node:assert/strict";
import { waitQueue } from "./campus.ts";
import { DEMO, FAKE_STATE, fakeServer, resetFake, withCommit } from "./fake.ts";
import { reduce, type Snapshot } from "./reduce.ts";
import type { BullpenState, Envelope, Fx } from "./types.ts";
import campus from "../../campus/campus.json" with { type: "json" };

const start: Snapshot = {
  data: { main: "main", worktrees: [], approvals: [], leases: [] },
  feed: [],
  merges: [],
  checks: [],
  plan: null,
  hooks: [],
  notice: null,
};

test("state replaces data and emits no fx", () => {
  const { snapshot, fx } = reduce(start, { type: "state", data: FAKE_STATE });
  assert.equal(snapshot.data, FAKE_STATE);
  assert.deepEqual(fx, []);
});

test("commit appends to the feed and fires a commit fx at the first file's building", () => {
  const withState = reduce(start, { type: "state", data: FAKE_STATE }).snapshot;
  const { snapshot, fx } = reduce(withState, {
    type: "commit",
    data: { agent: "web", sha: "abc1234", message: "Add page", files: ["web/Page.tsx", "api/x.py"] },
  });
  const last = snapshot.feed.at(-1);
  assert.equal(snapshot.feed.length, withState.feed.length + 1);
  assert.equal(last?.color, "#3e63dd");
  assert.equal(last?.message, "Add page");
  assert.deepEqual(fx, [{ kind: "commit", agent: "web", building: "msc" }]);
});

test("state seeds the feed from worktree commits, oldest first, without duplicates", () => {
  const seeded = reduce(start, { type: "state", data: FAKE_STATE }).snapshot;
  assert.deepEqual(
    seeded.feed.map((f) => f.sha),
    ["9f8e7d6", "a1b2c3d", "4c5d6e7", "1a2b3c4"],
  );
  const again = reduce(seeded, { type: "state", data: FAKE_STATE }).snapshot;
  assert.equal(again.feed, seeded.feed);
});

test("a commit already seeded from state is not added twice but still fires fx", () => {
  const seeded = reduce(start, { type: "state", data: FAKE_STATE }).snapshot;
  const { snapshot, fx } = reduce(seeded, {
    type: "commit",
    data: { agent: "api", sha: "a1b2c3d", message: "Add users route", files: ["api/users.py"] },
  });
  assert.equal(snapshot.feed.length, seeded.feed.length);
  assert.equal(fx.length, 1);
});

test("hook envelopes record compact log entries without emitting fx", () => {
  const { snapshot, fx } = reduce(start, {
    type: "hook",
    data: { agent: "api", event: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "api/users.ts" } },
  });
  assert.deepEqual(fx, []);
  assert.equal(snapshot.hooks.length, 1);
  assert.equal(snapshot.hooks[0].agent, "api");
  assert.equal(snapshot.hooks[0].tool, "Edit");
  assert.equal(snapshot.hooks[0].target, "api/users.ts");
});

test("check envelopes prepend to the referee log including offline fail-closed entries", () => {
  const first = reduce(start, {
    type: "check",
    data: {
      agent: "db",
      tool: "Edit",
      file: "db/schema.sql",
      decision: "deny",
      rule: "offline",
      latency_ms: 0,
      model: "",
      at: "2026-11-21T18:00:00Z",
    },
  }).snapshot;
  assert.equal(first.checks.length, 1);
  assert.equal(first.checks[0].decision, "deny");
  assert.equal(first.checks[0].rule, "offline");
});

test("plan envelopes store the orchestrator task split", () => {
  const { snapshot } = reduce(start, {
    type: "plan",
    data: {
      ask: "Add roles",
      tasks: [
        { agent: "api", task: "Add role middleware" },
        { agent: "web", task: "Show role badge" },
        { agent: "db", task: "Add role column" },
      ],
    },
  });
  assert.equal(snapshot.plan?.ask, "Add roles");
  assert.equal(snapshot.plan?.tasks.length, 3);
});

test("fake undo resets the agent and fires an undo fx", () => {
  let snapshot = reduce(start, { type: "state", data: FAKE_STATE }).snapshot;
  const fx: Fx[] = [];
  for (const envelope of fakeServer({ kind: "undo", agent: "api" })) {
    const r = reduce(snapshot, envelope);
    snapshot = r.snapshot;
    fx.push(...r.fx);
  }
  assert.deepEqual(fx, [{ kind: "undo", agent: "api" }]);
  const api = snapshot.data.worktrees.find((w) => w.agent === "api");
  assert.deepEqual([api?.changed_files, api?.claims, api?.building], [[], [], "bullrunner"]);
});

test("withCommit bumps ahead and adds the commit and its files to that agent only", () => {
  const next = withCommit(FAKE_STATE, "web", { sha: "x1", message: "m", files: ["web/api.ts"] });
  const web = next.worktrees.find((w) => w.agent === "web");
  assert.equal(web?.ahead, 2);
  assert.equal(web?.commits[0].sha, "x1");
  assert.ok(web?.changed_files.includes("web/api.ts"));
  assert.equal(next.worktrees[0], FAKE_STATE.worktrees[0]);
});

test("the demo ends with no approvals, api merged with an intent card, web undone, and every commit in the feed", () => {
  let snapshot = reduce(start, { type: "state", data: FAKE_STATE }).snapshot;
  for (const step of DEMO) for (const envelope of step.run()) snapshot = reduce(snapshot, envelope).snapshot;
  const byAgent = Object.fromEntries(snapshot.data.worktrees.map((w) => [w.agent, w]));
  assert.deepEqual(snapshot.data.approvals, []);
  assert.equal(byAgent.api.status, "done");
  assert.equal(byAgent.web.ahead, 0);
  assert.equal(byAgent.db.ahead, 2);
  assert.equal(byAgent.db.status, "working");
  for (const sha of ["b7c8d9e", "e1f2a3b", "c4d5e6f", "a1b2c3d"]) assert.ok(snapshot.feed.some((f) => f.sha === sha), sha);
  assert.equal(snapshot.merges.length, 1);
  assert.equal(snapshot.merges[0].agent, "api");
  assert.ok(snapshot.merges[0].intent.includes("Add /users endpoint"));
  assert.ok(snapshot.merges[0].commits.some((c) => c.sha === "b7c8d9e"));
});

test("merge records an intent card with agent, commits, and intent text that survives the following state reset", () => {
  const seeded = reduce(start, { type: "state", data: FAKE_STATE }).snapshot;
  const merged = reduce(seeded, {
    type: "merge",
    data: { agent: "api", sha: "a1b2c3d", intent: "Added the /users endpoint and documented its usage." },
  });
  assert.deepEqual(merged.fx, [{ kind: "merge", agent: "api" }]);
  assert.equal(merged.snapshot.merges.length, 1);
  const card = merged.snapshot.merges[0];
  assert.equal(card.agent, "api");
  assert.equal(card.color, "#e5484d");
  assert.equal(card.sha, "a1b2c3d");
  assert.equal(card.intent, "Added the /users endpoint and documented its usage.");
  assert.deepEqual(
    card.commits.map((c) => c.sha),
    ["a1b2c3d", "9f8e7d6"],
  );

  // Subsequent state envelope clears the merged worktree's commits, but the merge intent card keeps them.
  const resetState = {
    ...FAKE_STATE,
    worktrees: FAKE_STATE.worktrees.map((w) =>
      w.agent === "api" ? { ...w, commits: [], ahead: 0, status: "done" as const, building: "bullrunner" } : w,
    ),
  };
  const afterState = reduce(merged.snapshot, { type: "state", data: resetState }).snapshot;
  assert.equal(afterState.merges.length, 1);
  assert.equal(afterState.merges[0].commits.length, 2);
});

test("merge handles empty intent string cleanly", () => {
  const seeded = reduce(start, { type: "state", data: FAKE_STATE }).snapshot;
  const { snapshot } = reduce(seeded, { type: "merge", data: { agent: "web", sha: "4c5d6e7", intent: "" } });
  assert.equal(snapshot.merges[0].agent, "web");
  assert.equal(snapshot.merges[0].intent, "");
  assert.equal(snapshot.merges[0].commits.length, 1);
});

// ---- section 4 envelopes from the real server (issue #17) ----

const wt = (agent: string) => ({ ...FAKE_STATE.worktrees[0], agent, building: "bullrunner", claims: [], status: "working" as const });
const live: BullpenState = { main: "main", worktrees: [wt("api"), wt("web"), wt("db")], approvals: [], leases: [] };
const run = (envelopes: Envelope[], from: Snapshot = reduce(start, { type: "state", data: live }).snapshot) =>
  envelopes.reduce((s, e) => reduce(s, e).snapshot, from);

test("claim_wait queues the agent behind the holder and moves it to the file's building", () => {
  const s = run([
    { type: "claim_granted", data: { agent: "api", file: "shared/auth.ts", building: "library", expires_at: "2026-11-21T19:00:00Z" } },
    { type: "claim_wait", data: { agent: "web", file: "shared/auth.ts", building: "library", holder: "api" } },
    { type: "claim_wait", data: { agent: "db", file: "shared/auth.ts", building: "library", holder: "api" } },
    { type: "claim_wait", data: { agent: "web", file: "shared/auth.ts", building: "library", holder: "api" } },
  ]);
  assert.deepEqual(s.data.leases, [
    { file: "shared/auth.ts", agent: "api", expires_at: "2026-11-21T19:00:00Z", waiters: ["web", "db"] },
  ]);
  assert.equal(s.data.worktrees.find((w) => w.agent === "web")?.building, "library");
});

test("claim_wait without a known lease records the holder from the event", () => {
  const s = run([{ type: "claim_wait", data: { agent: "web", file: "api/a.py", building: "enb", holder: "api" } }]);
  assert.deepEqual(s.data.leases, [{ file: "api/a.py", agent: "api", expires_at: "", waiters: ["web"] }]);
});

test("claim_released then claim_granted hands the file to the waiter and takes it out of the line", () => {
  const s = run([
    { type: "claim_granted", data: { agent: "api", file: "shared/auth.ts", building: "library", expires_at: "t1" } },
    { type: "claim_wait", data: { agent: "web", file: "shared/auth.ts", building: "library", holder: "api" } },
    { type: "claim_wait", data: { agent: "db", file: "shared/auth.ts", building: "library", holder: "api" } },
    { type: "claim_released", data: { agent: "api", file: "shared/auth.ts", building: "library", text: "commit" } },
    { type: "claim_granted", data: { agent: "web", file: "shared/auth.ts", building: "library", expires_at: "t2" } },
  ]);
  // The release dropped the lease with its line; the server's next `state` restores db's spot.
  assert.deepEqual(s.data.leases, [{ file: "shared/auth.ts", agent: "web", expires_at: "t2", waiters: [] }]);
  const kept = run([
    { type: "claim_granted", data: { agent: "api", file: "f", building: "library", expires_at: "t1" } },
    { type: "claim_wait", data: { agent: "web", file: "f", building: "library", holder: "api" } },
    { type: "claim_wait", data: { agent: "db", file: "f", building: "library", holder: "api" } },
    { type: "claim_granted", data: { agent: "web", file: "f", building: "library", expires_at: "t2" } },
  ]);
  assert.deepEqual(kept.data.leases?.[0].waiters, ["db"]);
});

test("claim_released only drops a lease the releasing agent holds", () => {
  const s = run([
    { type: "claim_granted", data: { agent: "api", file: "f", building: "library", expires_at: "t1" } },
    { type: "claim_released", data: { agent: "web", file: "f", building: "library", text: "stop" } },
  ]);
  assert.equal(s.data.leases?.length, 1);
});

test("approval_needed adds a card once; approved and denied remove it", () => {
  const ap = { id: "ap7", agent: "db", tool: "Edit", target: "db/schema.sql", reason: "Sun Dome is guarded", expires_at: "2026-11-21T19:01:00Z" };
  const needed = run([
    { type: "approval_needed", data: ap },
    { type: "approval_needed", data: ap },
    { type: "approval_needed", data: { ...ap, id: "ap8" } },
  ]);
  assert.deepEqual(needed.data.approvals.map((a) => a.id), ["ap7", "ap8"]);
  assert.equal(needed.data.approvals[0].expires_at, ap.expires_at);
  const done = run(
    [
      { type: "denied", data: { id: "ap7", agent: "db", text: "human" } },
      { type: "approved", data: { id: "ap8", agent: "db" } },
    ],
    needed,
  );
  assert.deepEqual(done.data.approvals, []);
});

test("the next state replaces everything the events patched", () => {
  const patched = run([
    { type: "approval_needed", data: { id: "ap1", agent: "db", tool: "Edit", target: "db/x.sql", reason: "" } },
    { type: "claim_wait", data: { agent: "web", file: "f", building: "library", holder: "api" } },
  ]);
  const s = reduce(patched, { type: "state", data: live }).snapshot;
  assert.equal(s.data, live);
});

test("secret_blocked sets a visible notice", () => {
  const s = run([{ type: "secret_blocked", data: { agent: "api", file: "api/.env", kind: "aws_key" } }]);
  assert.equal(s.notice, "Secret guard blocked api's edit to api/.env (aws_key).");
});

test("commit and undo and merge from the server keep working with the new fields", () => {
  const { fx } = reduce(run([]), {
    type: "commit",
    data: { agent: "api", sha: "abc", message: "Edit x", files: ["shared/auth.ts"], task: "t", at: "2026-11-21T19:00:00Z" },
  });
  assert.deepEqual(fx, [{ kind: "commit", agent: "api", building: "library" }]);
  assert.deepEqual(reduce(start, { type: "undo", data: { agent: "web" } }).fx, [{ kind: "undo", agent: "web" }]);
});

test("unknown envelope types change nothing", () => {
  const from = run([]);
  const { snapshot, fx } = reduce(from, { type: "future_thing", data: {} } as unknown as Envelope);
  assert.equal(snapshot, from);
  assert.deepEqual(fx, []);
});

test("replayed envelopes render like live ones", () => {
  const s = run([
    { type: "claim_granted", data: { agent: "api", file: "f", building: "library", expires_at: "t" }, replay: true },
    { type: "approval_needed", data: { id: "ap1", agent: "db", tool: "Edit", target: "db/x.sql", reason: "" }, replay: true },
  ]);
  assert.equal(s.data.leases?.length, 1);
  assert.equal(s.data.approvals.length, 1);
  assert.deepEqual(reduce(start, { type: "state", data: live, replay: true }).snapshot.data, live);
});

test("waitQueue gives each waiter its 1-based place, oldest first, at the file's building", () => {
  const q = waitQueue(
    [
      { file: "shared/auth.ts", agent: "api", expires_at: "", waiters: ["web", "db"] },
      { file: "api/users.py", agent: "api", expires_at: "", waiters: ["db"] },
    ],
    campus.buildings,
  );
  assert.deepEqual(q.get("web"), { file: "shared/auth.ts", building: "library", pos: 1 });
  assert.deepEqual(q.get("db"), { file: "shared/auth.ts", building: "library", pos: 2 });
  assert.equal(q.has("api"), false);
});

test("the demo shows a wait queue, then hands the file over and ends with nobody in line", () => {
  resetFake();
  let snapshot = reduce(start, { type: "state", data: FAKE_STATE }).snapshot;
  const queues: string[] = [];
  for (const step of DEMO) {
    for (const envelope of step.run()) snapshot = reduce(snapshot, envelope).snapshot;
    const q = waitQueue(snapshot.data.leases ?? [], campus.buildings);
    queues.push([...q].map(([a, s]) => `${a}@${s.building}#${s.pos}`).sort().join(" "));
  }
  assert.ok(queues.includes("db@enb#1 web@enb#2"), queues.join(" | "));
  assert.ok(queues.includes("web@enb#1"), queues.join(" | "));
  assert.equal(queues.at(-1), "");
});
