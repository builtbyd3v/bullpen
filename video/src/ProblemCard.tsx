import { useCurrentFrame, useVideoConfig } from "remotion";
import { BULL, Stage, W, bullPal, expoOut, flip, hash, newPen, rect, seg, sprite, text, textW, type Pen } from "./pixel";
import { C } from "./types";

// The problem, in 10 s: two agents in separate worktrees edit the same file. Each pull request is clean
// against main, the first merge lands, the second one conflicts. Colors are the agent colors from web/lib/fake.ts.

const GREEN = "#9CCB3B";
const RED = "#D64045";
const AGENTS = [
  { name: "API", pr: "PR #1", body: "#e5484d", shade: "#a3262c", box: 24, rows: BULL },
  { name: "WEB", pr: "PR #2", body: "#3e63dd", shade: "#253c96", box: 252, rows: flip(BULL) },
];
const BOX_W = 204;
const BOX_Y = 10;
const BOX_H = 122;
const CELL = 5;
const MAIN_Y = 180;

// Beat times in seconds.
const EDIT = 0.8;
const PASS = [3.0, 3.5];
const MERGE_1 = 4.8;
const MERGE_2 = 5.9;
const HIT = 6.5;
const ANGRY = 6.8;
const LINE = 7.4;

function tick(pen: Pen, x: number, y: number, color: string) {
  [[0, 2], [1, 3], [2, 4], [3, 3], [4, 2], [5, 1], [6, 0]].forEach(([dx, dy]) => rect(pen, x + dx, y + dy, 1, 2, color));
}
function cross(pen: Pen, x: number, y: number, color: string) {
  for (let i = 0; i < 6; i++) {
    rect(pen, x + i, y + i, 2, 1, color);
    rect(pen, x + 5 - i, y + i, 2, 1, color);
  }
}

function scene(t: number, frame: number): Pen {
  const pen = newPen();
  const angry = t >= ANGRY;

  AGENTS.forEach((a, n) => {
    const left = n === 0;
    const enter = seg(t, n * 0.15, 0.6 + n * 0.15, expoOut);
    const x0 = a.box;
    const y0 = BOX_Y + (1 - enter) * 8;

    // Worktree box.
    pen.alpha = enter;
    rect(pen, x0, y0, BOX_W, BOX_H, C.sand);
    rect(pen, x0 + 2, y0 + 2, BOX_W - 4, BOX_H - 4, C.evergreen);
    text(pen, `WORKTREE: ${a.name}`, x0 + 8, y0 + 8, 1, C.gold);

    // The file both agents edit sits on the inner side of each box, so the two copies face each other.
    const fx = left ? x0 + 124 : x0 + 10;
    rect(pen, fx, y0 + 30, 70, 78, C.ink);
    text(pen, "SHARED/", fx + 5, y0 + 35, 1, C.sand);
    text(pen, "AUTH.TS", fx + 5, y0 + 45, 1, C.sand);
    for (let i = 0; i < 6; i++) {
      // Each code line types in, in the agent's color.
      const grow = seg(t, EDIT + i * 0.3 + n * 0.1, EDIT + i * 0.3 + n * 0.1 + 0.35);
      rect(pen, fx + 5, y0 + 59 + i * 7, Math.round((22 + hash(i, n + 2) * 36) * grow), 3, a.body);
    }

    // The agent. It bobs while it works, and shakes one pixel side to side once the merge breaks.
    const bob = !angry && t > EDIT && Math.floor(t * 3 + n) % 2 === 1 ? 1 : 0;
    const shake = angry ? (Math.floor(frame / 2 + n) % 2 === 0 ? -1 : 1) : 0;
    const bx = (left ? x0 + 8 : x0 + 86) + shake;
    const by = y0 + 28 + bob;
    sprite(pen, a.rows, bullPal(a.body, a.shade), bx, by, CELL);

    if (angry) {
      // A red "!" over the head, and steam puffs that rise and fade in a loop.
      const head = bx + (left ? 86 : 24);
      const pop = seg(t, ANGRY, ANGRY + 0.25, expoOut);
      pen.alpha = pop;
      rect(pen, head - 2, by - 14 + (1 - pop) * 4, 4, 10, RED);
      rect(pen, head - 2, by - 2 + (1 - pop) * 4, 4, 4, RED);
      for (let i = 0; i < 4; i++) {
        const life = (t - ANGRY + i * 0.3 + n * 0.15) % 1.2;
        const r = 2 + Math.round(life * 3);
        pen.alpha = 0.6 * (1 - life / 1.2);
        rect(pen, head + (i % 2 ? 12 : -18) + hash(i, 4) * 4, by + 4 - life * 16, r * 2, r, C.sand);
      }
    }

    // Pull request badge under the box: green and clean, until the second merge turns red.
    const shown = seg(t, PASS[n], PASS[n] + 0.4, expoOut);
    const broke = !left && t >= HIT;
    const merged = left && t >= MERGE_1 + 0.6;
    const color = broke ? RED : GREEN;
    const label = broke ? `${a.pr} CONFLICT` : merged ? `${a.pr} MERGED` : `${a.pr} NO CONFLICTS WITH MAIN`;
    pen.alpha = shown;
    const py = 138 + (1 - shown) * 4;
    rect(pen, x0, py, BOX_W, 15, color);
    rect(pen, x0 + 1, py + 1, BOX_W - 2, 13, C.ink);
    if (broke) cross(pen, x0 + 7, py + 4, color);
    else tick(pen, x0 + 6, py + 4, color);
    text(pen, label, x0 + 20, py + 4, 1, color);

    // Merge line from the badge down to main.
    const start = left ? MERGE_1 : MERGE_2;
    const drop = seg(t, start, start + 0.6, expoOut);
    pen.alpha = 1;
    rect(pen, x0 + BOX_W / 2 - 2, 153, 4, Math.round((MAIN_Y - 153) * drop), color);
  });

  // Main: one bar both merges land on.
  pen.alpha = seg(t, PASS[0], PASS[0] + 0.4);
  text(pen, "MAIN", 24, MAIN_Y - 1, 1, C.gold);
  rect(pen, 56, MAIN_Y, 400, 5, t >= HIT ? RED : C.gold);

  // The line that names the problem, word by word.
  const words = ["BOTH", "PRs", "PASSED.", "TOGETHER", "THEY", "BROKE."];
  let x = W / 2 - textW(words.join(" "), 2) / 2;
  words.forEach((word, i) => {
    const k = seg(t, LINE + i * 0.14, LINE + i * 0.14 + 0.5, expoOut);
    pen.alpha = k;
    text(pen, word, x, 204 + (1 - k) * 4, 2, C.sand);
    x += (word.length + 1) * 12;
  });
  return pen;
}

export function ProblemCard({ speed = 1 }: { speed?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <Stage pen={scene((frame / fps) * speed, frame)} />;
}
