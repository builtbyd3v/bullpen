import { test } from "node:test";
import assert from "node:assert/strict";
import { hunkRanges, intersect, overlaps } from "./overlap.ts";
import type { Worktree } from "./types.ts";

const wt = (agent: string, changed_files: string[]) => ({ agent, changed_files }) as Worktree;

test("a file changed on two branches is an overlap", () => {
  assert.deepEqual(overlaps([wt("api", ["shared/auth.ts", "api/users.ts"]), wt("web", ["shared/auth.ts"]), wt("db", ["db/seed.sql"])]), [
    { file: "shared/auth.ts", agents: ["api", "web"] },
  ]);
});

test("hunk headers give new-side ranges and their intersection", () => {
  const a = hunkRanges("@@ -10,4 +10,8 @@ x\n+a\n@@ -40 +44 @@\n");
  assert.deepEqual(a, [{ start: 10, end: 17 }, { start: 44, end: 44 }]);
  assert.deepEqual(intersect(a, hunkRanges("@@ -10,4 +12,5 @@\n")), [{ start: 12, end: 16 }]);
});
