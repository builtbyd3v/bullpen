import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO } from "./types";

// Intro B "charge across" from design/mockups-v3/index.html (section 07), ported as is.
// The original paints a 480x270 canvas with fillRect only, so here the same calls collect rects for an SVG.
// Every frame is a pure function of t, with no state between frames.

type Rect = { x: number; y: number; w: number; h: number; fill: string; alpha: number };
type Pen = { fill: string; alpha: number; rects: Rect[] };
const rect = (pen: Pen, x: number, y: number, w: number, h: number) => {
  if (pen.alpha > 0) pen.rects.push({ x, y, w, h, fill: pen.fill, alpha: pen.alpha });
};

const W = 480;
const H = 270;
const BG = "#072E20";

// The 20x15 bull from web/app/bullSprite.ts. Copied because importing it pulls in Phaser.
const BULL_ROWS = [
  "..............H....H",
  "..............h....h",
  "..............hh..hh",
  ".....cccc.....hhhh..",
  "....cccccccc..ccccc.",
  ".d.ccccccccccdccccc.",
  ".dcccccccccccdeepcc.",
  ".dcccccccccccdccttnn",
  "..cccccccccccccctttt",
  "..ddddddddddddddddd.",
  "...cc.dd....cc.dd...",
  "...cc.dd....cc.dd...",
  "...cc.dd....cc.dd...",
  "...cc.dd....cc.dd...",
  "...kk.kk....kk.kk...",
];
const RUN_LEGS = ["..cc...dd..cc...dd..", "..cc...dd..cc...dd..", "..kk...kk..kk...kk.."];
// Green body, gold horns, sand outline so the shade and far legs read on the dark ground.
const PAL: Record<string, string> = {
  c: C.green, d: "#003e2b", t: "#d9b382", n: "#a67f54", h: C.gold, H: C.gold, e: "#ffffff", p: "#1b1b2f", k: "#2a2a40", o: C.sand,
};

function outline(rows: string[], ch: string): string[] {
  const g = rows.map((r) => [...r]);
  const add: [number, number][] = [];
  g.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell !== ".") return;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => {
        const c = g[y + b]?.[x + a];
        return c && c !== "." && c !== ch;
      });
      if (near) add.push([x, y]);
    }),
  );
  add.forEach(([x, y]) => (g[y][x] = ch));
  return g.map((r) => r.join(""));
}
// One blank cell of padding on every side, so the outline has room.
const pad = (rows: string[]) => [".".repeat(22), ...rows.map((r) => `.${r}.`), ".".repeat(22)];
const BULL = outline(pad(BULL_ROWS), "o");
const RUN = outline(pad(BULL_ROWS.map((r, y) => (y < 12 ? r : RUN_LEGS[y - 12]))), "o");
const BC = 4;
const BX = W / 2 - (BULL[0].length * BC) / 2;
const BY = 64;

const GLYPHS: Record<string, string[]> = {
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  a: [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
  c: [".....", ".....", ".###.", "#....", "#....", "#...#", ".###."],
  e: [".....", ".....", ".###.", "#...#", "#####", "#....", ".###."],
  f: ["..##.", ".#..#", ".#...", "###..", ".#...", ".#...", ".#..."],
  g: [".....", ".####", "#...#", "#...#", ".####", "....#", ".###."],
  l: [".##..", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  n: [".....", ".....", "#.##.", "##..#", "#...#", "#...#", "#...#"],
  o: [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
  r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
  s: [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
  t: [".#...", ".#...", "####.", ".#...", ".#...", ".#..#", "..##."],
  u: [".....", ".....", "#...#", "#...#", "#...#", "#..##", ".##.#"],
};
const TITLE = "BULLPEN";
const TC = 4;
const TY = 148;
const GC = 2;
const GY = 194;
const wordW = (s: string, cell: number) => (s.length * 6 - 1) * cell;
// The pixel tagline has glyphs for the opening line only. Any other tagline renders as text below the lockup.
const canPixel = (s: string) => [...s].every((ch) => ch === " " || GLYPHS[ch]);

// Same seeded random as the mockup: same index, same value, every render.
function hash(i: number, s: number): number {
  let a = (i * 9973 + s * 7919) | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const seg = (t: number, a: number, b: number, e = (v: number) => v) => e(clamp((t - a) / (b - a)));
const stagger = (t: number, t0: number, step: number, dur: number) => (i: number) => seg(t, t0 + i * step, t0 + i * step + dur, expoOut);

function glyph(pen: Pen, ch: string, x: number, y: number, cell: number, color: string) {
  const g = GLYPHS[ch];
  if (!g) return;
  pen.fill = color;
  for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === "#") rect(pen, Math.round(x + c * cell), Math.round(y + r * cell), cell, cell);
}

function sprite(pen: Pen, rows: string[], x: number, y: number) {
  pen.alpha = 1;
  rows.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (!PAL[ch]) return;
      pen.fill = PAL[ch];
      rect(pen, Math.round(x) + i * BC, Math.round(y) + j * BC, BC, BC);
    }),
  );
}

const runX = (t: number) => lerp(-300, BX, seg(t, 0, 2.2, expoOut));

function charge(t: number, tagline: string): Rect[] {
  const pen: Pen = { fill: BG, alpha: 1, rects: [] };
  rect(pen, 0, 0, W, H);

  // Dust: puff i is born where the back hooves were at time ti, then grows and fades.
  const ground = BY + BULL.length * BC - 2;
  for (let i = 0; i < 26; i++) {
    const ti = 0.3 + i * 0.05;
    const a = t - ti;
    const life = 0.9 + hash(i, 3) * 0.6;
    if (a < 0 || a > life) continue;
    const r = Math.round(2 + a * 7 * (0.6 + hash(i, 5)));
    const x = runX(ti) + 8 + hash(i, 9) * 14 - a * 14;
    const y = ground - hash(i, 11) * 6 - a * 6;
    pen.alpha = 0.4 * (1 - a / life) * (1 - i / 30);
    pen.fill = C.sand;
    rect(pen, Math.round(x - r), Math.round(y - r / 2), r * 2, r);
    rect(pen, Math.round(x - r / 2), Math.round(y - r), r, r * 2);
  }

  // Two leg frames, keyed to distance covered, so the gait slows as the bull does.
  const x = runX(t);
  const moving = runX(t + 0.03) - x > 0.4;
  const step = moving && Math.floor((x + 300) / 14) % 2 === 1;
  sprite(pen, step ? RUN : BULL, x, BY - (step ? 2 : 0));

  // Title letters lift 10 px and fade in, one by one, over a dark drop shadow.
  const titleIn = stagger(t, 1.9, 0.07, 0.55);
  const tx = W / 2 - wordW(TITLE, TC) / 2;
  [...TITLE].forEach((ch, i) => {
    const k = titleIn(i);
    pen.alpha = k;
    const lx = tx + i * 6 * TC;
    const ly = TY + (1 - k) * 10;
    glyph(pen, ch, lx + TC, ly + TC, TC, "#003822");
    glyph(pen, ch, lx, ly, TC, C.sand);
  });

  if (canPixel(tagline)) {
    const tagIn = stagger(t, 2.6, 0.15, 0.5);
    const gx = W / 2 - wordW(tagline, GC) / 2;
    let at = 0;
    tagline.split(" ").forEach((word, j) => {
      const k = tagIn(j);
      pen.alpha = k;
      [...word].forEach((ch, i) => glyph(pen, ch, gx + (at + i) * 6 * GC, GY + (1 - k) * 6, GC, C.gold));
      at += word.length + 1;
    });
  }
  return pen.rects;
}

// `still` skips the run: the finished lockup holds while the tagline comes in. Used for the closing card.
export function TitleCard({ tagline, still = false }: { tagline: string; still?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rects = charge(still ? 5 : frame / fps, tagline);
  let n = 0;
  return (
    <AbsoluteFill style={{ background: BG }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" shapeRendering="crispEdges">
        {rects.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} opacity={r.alpha} />
        ))}
      </svg>
      {canPixel(tagline) ? null : (
        <div style={{ position: "absolute", top: GY * 4 - 16, width: "100%", fontFamily: MONO, fontSize: 40, color: C.gold, textAlign: "center", lineHeight: 1.5 }}>
          {tagline.split(/(?<=\.)\s/).map((line, l) => (
            <div key={l}>
              {line.split(" ").map((word) => {
                const i = n++;
                const opacity = interpolate(frame, [12 + i * 4, 22 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                return (
                  <span key={i} style={{ opacity }}>
                    {word}{" "}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
}
