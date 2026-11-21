import Phaser from "phaser";

// 20x15 pixel-art USF Bull mascot (2px cells) facing right, tinted in the agent's color.
// Shared between CampusScene and InteriorScene so sprites stay identical (no AI-model mascot names).
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

export function makeBull(scene: Phaser.Scene, color: number): Phaser.GameObjects.GameObject[] {
  const shade = Phaser.Display.Color.IntegerToColor(color).darken(40).color;
  const fills: Record<string, number> = {
    c: color,
    d: shade,
    t: 0xd9b382,
    n: 0xa67f54,
    h: 0xf5f0e1,
    H: 0xffffff,
    e: 0xffffff,
    p: 0x1b1b2f,
    k: 0x2a2a40,
  };
  const g = scene.add.graphics();
  // Subtle pixel ground shadow beneath the hooves so the bull reads cleanly over walkways & rooms
  g.fillStyle(0x040a07, 0.55).fillRect(-12, 6, 30, 4);
  // Crisp 1-cell dark pixel outline behind every filled pixel for high contrast on dark or light tiles
  g.fillStyle(0x07120d, 0.9);
  BULL_ROWS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (fills[ch] !== undefined) g.fillRect(-17 + x * 2, -23 + y * 2, 4, 4);
    }),
  );
  BULL_ROWS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (fills[ch] !== undefined) g.fillStyle(fills[ch]).fillRect(-16 + x * 2, -22 + y * 2, 2, 2);
    }),
  );
  return [g];
}
