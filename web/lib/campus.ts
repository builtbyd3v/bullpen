import type { Building, Worktree } from "./types.ts";

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
