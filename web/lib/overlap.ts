import type { Worktree } from "./types.ts";

export type Overlap = { file: string; agents: string[] };

// Files changed on two or more agent branches. Each branch can merge cleanly into main and still collide with another.
export function overlaps(worktrees: Worktree[]): Overlap[] {
  const byFile = new Map<string, string[]>();
  for (const w of worktrees) for (const f of w.changed_files) byFile.set(f, [...(byFile.get(f) ?? []), w.agent]);
  return [...byFile].filter(([, agents]) => agents.length > 1).map(([file, agents]) => ({ file, agents }));
}

export type LineRange = { start: number; end: number };

// New-side line ranges touched by a unified diff, from its @@ hunk headers.
export function hunkRanges(diff: string): LineRange[] {
  return [...diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)].map((m) => {
    const start = Number(m[1]);
    return { start, end: start + Math.max(Number(m[2] ?? 1), 1) - 1 };
  });
}

// Ranges present in both lists (where two branches rewrite the same lines).
export function intersect(a: LineRange[], b: LineRange[]): LineRange[] {
  const out: LineRange[] = [];
  for (const x of a) for (const y of b) {
    const start = Math.max(x.start, y.start), end = Math.min(x.end, y.end);
    if (start <= end) out.push({ start, end });
  }
  return out;
}
