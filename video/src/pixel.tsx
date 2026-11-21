import { AbsoluteFill } from "remotion";
import type { ReactNode } from "react";
import { C } from "./types";

// Pixel drawing kit shared by the generated cards, ported from design/mockups-v3/index.html.
// The mockups paint a 480x270 canvas with fillRect only. Here the same calls collect rects for an SVG,
// so every frame is a pure function of time, with no state between frames.

export type Rect = { x: number; y: number; w: number; h: number; fill: string; alpha: number };
export type Pen = { fill: string; alpha: number; rects: Rect[] };
export const W = 480;
export const H = 270;
export const BG = "#072E20";

export const newPen = (): Pen => {
  const pen: Pen = { fill: BG, alpha: 1, rects: [] };
  rect(pen, 0, 0, W, H);
  return pen;
};
export function rect(pen: Pen, x: number, y: number, w: number, h: number, fill = pen.fill) {
  if (pen.alpha > 0 && w > 0 && h > 0) pen.rects.push({ x: Math.round(x), y: Math.round(y), w, h, fill, alpha: pen.alpha });
}

// 5x7 pixel font. Lowercase exists only for the letters the title tagline needs; other lowercase falls back to capitals.
const GLYPHS: Record<string, string[]> = {
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'], D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'], H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'], J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
    K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'], R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'], X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], 1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], 3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'], 5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'], 7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'], 9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
    ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'], '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
    ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'], ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
    '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'], '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
    '_': ['.....', '.....', '.....', '.....', '.....', '.....', '#####'], "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
    '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'], '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
    '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'], '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
    ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'], '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'], '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
    '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'], '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  a: [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"], c: [".....", ".....", ".###.", "#....", "#....", "#...#", ".###."],
  e: [".....", ".....", ".###.", "#...#", "#####", "#....", ".###."], f: ["..##.", ".#..#", ".#...", "###..", ".#...", ".#...", ".#..."],
  g: [".....", ".####", "#...#", "#...#", ".####", "....#", ".###."], l: [".##..", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  n: [".....", ".....", "#.##.", "##..#", "#...#", "#...#", "#...#"], o: [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
  r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."], s: [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
  t: [".#...", ".#...", "####.", ".#...", ".#...", ".#..#", "..##."], u: [".....", ".....", "#...#", "#...#", "#...#", "#..##", ".##.#"],
};
const glyphOf = (ch: string) => GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? GLYPHS["?"];
export const textW = (s: string, cell: number) => (s.length * 6 - 1) * cell;
export function glyph(pen: Pen, ch: string, x: number, y: number, cell: number, color: string) {
  const g = glyphOf(ch);
  for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === "#") rect(pen, x + c * cell, y + r * cell, cell, cell, color);
}
// Text with its left edge at x, or centered on x.
export function text(pen: Pen, s: string, x: number, y: number, cell: number, color: string, center = false) {
  const x0 = center ? x - textW(s, cell) / 2 : x;
  [...s].forEach((ch, i) => glyph(pen, ch, x0 + i * 6 * cell, y, cell, color));
}

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
// One blank cell of padding on every side, so the outline has room. The sprites are 22 x 17 cells.
const pad = (rows: string[]) => [".".repeat(22), ...rows.map((r) => `.${r}.`), ".".repeat(22)];
export const BULL = outline(pad(BULL_ROWS), "o");
export const RUN = outline(pad(BULL_ROWS.map((r, y) => (y < 12 ? r : RUN_LEGS[y - 12]))), "o");
export const flip = (rows: string[]) => rows.map((r) => [...r].reverse().join(""));

// Body color and its shade vary per bull; horns default to gold, the outline to sand.
export const bullPal = (body: string, shade: string): Record<string, string> => ({
  c: body, d: shade, t: "#d9b382", n: "#a67f54", h: C.gold, H: C.gold, e: "#ffffff", p: "#1b1b2f", k: "#2a2a40", o: C.sand,
});
export function sprite(pen: Pen, rows: string[], pal: Record<string, string>, x: number, y: number, cell: number) {
  rows.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (pal[ch]) rect(pen, Math.round(x) + i * cell, Math.round(y) + j * cell, cell, cell, pal[ch]);
    }),
  );
}

// Same seeded random as the mockup: same index, same value, every render.
export function hash(i: number, s: number): number {
  let a = (i * 9973 + s * 7919) | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const clamp = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
// Progress of t inside [a, b], from 0 to 1, eased.
export const seg = (t: number, a: number, b: number, e = (v: number) => v) => e(clamp((t - a) / (b - a)));

export function Stage({ pen, children }: { pen: Pen; children?: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: BG }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" shapeRendering="crispEdges">
        {pen.rects.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} opacity={r.alpha} />
        ))}
      </svg>
      {children}
    </AbsoluteFill>
  );
}
