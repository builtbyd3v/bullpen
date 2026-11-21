import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BULL, RUN, Stage, W, bullPal, expoOut, glyph, hash, lerp, newPen, rect, seg, sprite, textW, type Pen } from "./pixel";
import { C, MONO } from "./types";

// Intro B "charge across" from design/mockups-v3/index.html (section 07), ported as is.

const PAL = bullPal(C.green, "#003e2b");
const BC = 4;
const BX = W / 2 - (BULL[0].length * BC) / 2;
const BY = 64;
const TITLE = "BULLPEN";
const TC = 4;
const TY = 148;
const GC = 2;
const GY = 194;
// The pixel tagline is for the opening line. Any longer tagline renders as text below the lockup.
const fitsPixel = (s: string) => textW(s, GC) <= W - 40;

const stagger = (t: number, t0: number, step: number, dur: number) => (i: number) => seg(t, t0 + i * step, t0 + i * step + dur, expoOut);
const runX = (t: number) => lerp(-300, BX, seg(t, 0, 2.2, expoOut));

function charge(t: number, tagline: string): Pen {
  const pen = newPen();

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
    rect(pen, x - r, y - r / 2, r * 2, r, C.sand);
    rect(pen, x - r / 2, y - r, r, r * 2, C.sand);
  }

  // Two leg frames, keyed to distance covered, so the gait slows as the bull does.
  const x = runX(t);
  const moving = runX(t + 0.03) - x > 0.4;
  const step = moving && Math.floor((x + 300) / 14) % 2 === 1;
  pen.alpha = 1;
  sprite(pen, step ? RUN : BULL, PAL, x, BY - (step ? 2 : 0), BC);

  // Title letters lift 10 px and fade in, one by one, over a dark drop shadow.
  const titleIn = stagger(t, 1.9, 0.07, 0.55);
  const tx = W / 2 - textW(TITLE, TC) / 2;
  [...TITLE].forEach((ch, i) => {
    const k = titleIn(i);
    pen.alpha = k;
    const lx = tx + i * 6 * TC;
    const ly = TY + (1 - k) * 10;
    glyph(pen, ch, lx + TC, ly + TC, TC, "#003822");
    glyph(pen, ch, lx, ly, TC, C.sand);
  });

  if (fitsPixel(tagline)) {
    const tagIn = stagger(t, 2.6, 0.15, 0.5);
    const gx = W / 2 - textW(tagline, GC) / 2;
    let at = 0;
    tagline.split(" ").forEach((word, j) => {
      const k = tagIn(j);
      pen.alpha = k;
      [...word].forEach((ch, i) => glyph(pen, ch, gx + (at + i) * 6 * GC, GY + (1 - k) * 6, GC, C.gold));
      at += word.length + 1;
    });
  }
  return pen;
}

// `still` skips the run: the finished lockup holds while the tagline comes in. Used for the closing card.
export function TitleCard({ tagline, still = false }: { tagline: string; still?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let n = 0;
  return (
    <Stage pen={charge(still ? 5 : frame / fps, tagline)}>
      {fitsPixel(tagline) ? null : (
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
    </Stage>
  );
}
