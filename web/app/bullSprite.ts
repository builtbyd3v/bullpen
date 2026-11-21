import Phaser from "phaser";

// Dev's 20x15 pixel-art Bull (2px cells) facing right, in the agent's color.
// Shared between CampusScene and InteriorScene so sprites stay identical.
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

export function makeBull(scene: Phaser.Scene, color: number): Phaser.GameObjects.GameObject[] {
  const shade = Phaser.Display.Color.IntegerToColor(color).darken(40).color;
  const fills: Record<string, number> = {
    c: color,
    d: shade,
    t: 0xd9b382,
    h: 0xf5f0e1,
    e: 0xffffff,
    p: 0x1b1b2f,
    k: 0x2a2a40,
  };
  const g = scene.add.graphics();
  BULL_ROWS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (fills[ch] !== undefined) g.fillStyle(fills[ch]).fillRect(-16 + x * 2, -22 + y * 2, 2, 2);
    }),
  );
  return [g];
}
