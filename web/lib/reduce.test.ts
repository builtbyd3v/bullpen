import { test } from "node:test";
import assert from "node:assert/strict";
import { FAKE_STATE, fakeServer } from "./fake.ts";
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
  assert.equal(snapshot.feed.length, 1);
  assert.equal(snapshot.feed[0].color, "#3e63dd");
  assert.equal(snapshot.feed[0].message, "Add page");
  assert.deepEqual(fx, [{ kind: "commit", agent: "web", building: "msc" }]);
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
