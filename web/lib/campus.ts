import type { Building, Lease, Worktree } from "./types.ts";

// Longest non-empty folder prefix wins. Root files go to folder "", the rest to folder null.
export function buildingForFile(path: string, buildings: Building[]): string {
  let best: Building | undefined;
  for (const b of buildings) {
    if (b.folder && path.startsWith(b.folder) && b.folder.length > (best?.folder?.length ?? 0)) best = b;
  }
  const fallback = path.includes("/") ? null : "";
  return (best ?? buildings.find((b) => b.folder === fallback))?.id ?? "";
}

export function layersByBuilding(worktrees: Worktree[], buildings: Building[]): Map<string, string[]> {
  const layers = new Map<string, string[]>();
  for (const w of worktrees) {
    for (const file of w.changed_files) {
      const id = buildingForFile(file, buildings);
      const agents = layers.get(id) ?? [];
      if (!agents.includes(w.agent)) agents.push(w.agent);
      layers.set(id, agents);
    }
  }
  return layers;
}

export type QueueSpot = { file: string; building: string; pos: number };

// Each waiting agent's place in line outside the door of the leased file's building.
// `pos` is 1-based, oldest first. An agent queued for several files stands in the first line only.
export function waitQueue(leases: Lease[], buildings: Building[]): Map<string, QueueSpot> {
  const spots = new Map<string, QueueSpot>();
  for (const l of leases) {
    l.waiters.forEach((agent, i) => {
      if (!spots.has(agent)) spots.set(agent, { file: l.file, building: buildingForFile(l.file, buildings), pos: i + 1 });
    });
  }
  return spots;
}
