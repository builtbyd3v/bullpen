import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, MONO } from "./types";

// Same 20x15 bull as web/app/bullSprite.ts. Copied because importing it pulls in Phaser.
const BULL_ROWS = [
  "..............h....h",
  "..............h....h",
  "..............hh..hh",
  ".....cccc.....hhhh..",
  "....cccccccc..ccccc.",
  ".d.ccccccccccdccccc.",
  ".dcccccccccccdeepcc.",
  ".dcccccccccccdcctttt",
  "..cccccccccccccctttt",
  "..ddddddddddddddddd.",
  "...cc.dd....cc.dd...",
  "...cc.dd....cc.dd...",
  "...cc.dd....cc.dd...",
  "...cc.dd....cc.dd...",
  "...kk.kk....kk.kk...",
];
const BULL_FILL: Record<string, string> = {
  c: C.gold,
  d: "#8F875F",
  t: "#D9B382",
  h: "#F5F0E1",
  e: C.white,
  p: "#1B1B2F",
  k: "#2A2A40",
};

const GLYPHS: Record<string, string[]> = {
  B: ["1111.", "1...1", "1...1", "1111.", "1...1", "1...1", "1111."],
  U: ["1...1", "1...1", "1...1", "1...1", "1...1", "1...1", ".111."],
  L: ["1....", "1....", "1....", "1....", "1....", "1....", "11111"],
  P: ["1111.", "1...1", "1...1", "1111.", "1....", "1....", "1...."],
  E: ["11111", "1....", "1....", "1111.", "1....", "1....", "11111"],
  N: ["1...1", "11..1", "11..1", "1.1.1", "1..11", "1..11", "1...1"],
};

const BULL_CELL = 18;
const TITLE_CELL = 20;
const LOAD_FRAMES = 36;
const BAR_CELLS = 14;

// Stable 0..1 value per pixel, so the load order looks hand-placed and never changes between renders.
const jitter = (x: number, y: number) => ((x * 7 + y * 13) % 10) / 10;

function Bull({ frame }: { frame: number }) {
  const bob = frame > LOAD_FRAMES && Math.floor(frame / 18) % 2 === 1 ? 2 : 0;
  return (
    <svg width={20 * BULL_CELL} height={15 * BULL_CELL} shapeRendering="crispEdges" style={{ marginTop: bob, marginBottom: -bob }}>
      {BULL_ROWS.flatMap((row, y) =>
        [...row].map((ch, x) => {
          const showAt = ((x + jitter(x, y) * 4) / 24) * LOAD_FRAMES;
          if (!BULL_FILL[ch] || frame < showAt) return null;
          return <rect key={`${x}-${y}`} x={x * BULL_CELL} y={y * BULL_CELL} width={BULL_CELL} height={BULL_CELL} fill={BULL_FILL[ch]} />;
        }),
      )}
    </svg>
  );
}

function LoadBar({ frame }: { frame: number }) {
  const filled = Math.min(BAR_CELLS, Math.floor((frame / LOAD_FRAMES) * BAR_CELLS));
  const opacity = interpolate(frame, [LOAD_FRAMES + 4, LOAD_FRAMES + 14], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ display: "flex", gap: 6, opacity, height: 14 }}>
      {Array.from({ length: BAR_CELLS }, (_, i) => (
        <div key={i} style={{ width: 18, height: 14, background: i < filled ? C.gold : C.evergreen }} />
      ))}
    </div>
  );
}

function Title({ frame }: { frame: number }) {
  const letters = [..."BULLPEN"];
  return (
    <div style={{ display: "flex", gap: TITLE_CELL }}>
      {letters.map((letter, i) => {
        const local = frame - (LOAD_FRAMES + 6 + i * 4);
        // Rises in two pixel steps, so the motion stays on the pixel grid.
        const lift = local < 0 ? 0 : local < 3 ? 2 : local < 6 ? 1 : 0;
        return (
          <svg key={i} width={5 * TITLE_CELL} height={7 * TITLE_CELL} shapeRendering="crispEdges" style={{ opacity: local < 0 ? 0 : 1, transform: `translateY(${lift * TITLE_CELL}px)` }}>
            {GLYPHS[letter].flatMap((row, y) =>
              [...row].map((ch, x) =>
                ch === "1" ? <rect key={`${x}-${y}`} x={x * TITLE_CELL} y={y * TITLE_CELL} width={TITLE_CELL} height={TITLE_CELL} fill={C.sand} /> : null,
              ),
            )}
          </svg>
        );
      })}
    </div>
  );
}

function Tagline({ frame, text }: { frame: number; text: string }) {
  const startAt = LOAD_FRAMES + 44;
  let n = 0;
  // One sentence per line, so a long tagline never wraps mid-thought.
  return (
    <div style={{ fontFamily: MONO, fontSize: 40, color: C.gold, textAlign: "center", lineHeight: 1.5 }}>
      {text.split(/(?<=\.)\s/).map((line, l) => (
        <div key={l}>
          {line.split(" ").map((word) => {
            const i = n++;
            const opacity = interpolate(frame, [startAt + i * 4, startAt + i * 4 + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <span key={i} style={{ opacity }}>
                {word}{" "}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function TitleCard({ tagline }: { tagline: string }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.green, alignItems: "center", justifyContent: "center", gap: 44 }}>
      <Bull frame={frame} />
      <LoadBar frame={frame} />
      <Title frame={frame} />
      <Tagline frame={frame} text={tagline} />
    </AbsoluteFill>
  );
}
