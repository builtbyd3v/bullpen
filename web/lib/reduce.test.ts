import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO, FAKE_STATE, fakeServer, withCommit } from "./fake.ts";
import { reduce, type Snapshot } from "./reduce.ts";
import type { Fx } from "./types.ts";

const start: Snapshot = { data: { main: "main", worktrees: [], approvals: [] }, feed: [] };

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

test("hook envelopes change nothing", () => {
  const { snapshot, fx } = reduce(start, { type: "hook", data: { agent: "api" } });
  assert.equal(snapshot, start);
  assert.deepEqual(fx, []);
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

test("the demo ends with no approvals, api merged, web undone, and every commit in the feed", () => {
  let snapshot = reduce(start, { type: "state", data: FAKE_STATE }).snapshot;
  for (const step of DEMO) for (const envelope of step.run()) snapshot = reduce(snapshot, envelope).snapshot;
  const byAgent = Object.fromEntries(snapshot.data.worktrees.map((w) => [w.agent, w]));
  assert.deepEqual(snapshot.data.approvals, []);
  assert.equal(byAgent.api.status, "done");
  assert.equal(byAgent.web.ahead, 0);
  assert.equal(byAgent.db.ahead, 2);
  assert.equal(byAgent.db.status, "working");
  for (const sha of ["b7c8d9e", "e1f2a3b", "c4d5e6f", "a1b2c3d"]) assert.ok(snapshot.feed.some((f) => f.sha === sha), sha);
});
