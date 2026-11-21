import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildingForFile, layersByBuilding } from "./campus.ts";
import type { Building, Worktree } from "./types.ts";

const { buildings } = JSON.parse(readFileSync(new URL("../../campus/campus.json", import.meta.url), "utf8")) as {
  buildings: Building[];
};

test("files map to the building of their folder, root, or the catch-all", () => {
  assert.equal(buildingForFile("web/x.tsx", buildings), "msc");
  assert.equal(buildingForFile("db/a.sql", buildings), "sundome");
  assert.equal(buildingForFile("README.md", buildings), "bullrunner");
  assert.equal(buildingForFile("random/x", buildings), "juniper");
});

test("two agents touching api/ are both layered on enb", () => {
  const wt = (agent: string, changed_files: string[]) => ({ agent, changed_files }) as Worktree;
  const layers = layersByBuilding([wt("api", ["api/a.py", "api/b.py"]), wt("web", ["web/x.tsx", "api/c.py"])], buildings);
  assert.deepEqual(layers.get("enb"), ["api", "web"]);
  assert.deepEqual(layers.get("msc"), ["web"]);
});
