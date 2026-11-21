import Phaser from "phaser";
import type { Building } from "@/lib/types.ts";

// Pixel-art USF Tampa campus building sprites & ground scenery (Issue #20).
// Drawn on a 2px pixel grid to match bullSprite.ts and the hourglass sprites.
// All mascots and labels represent USF buildings / repo folders (no AI-model names).

const INK = 0x07120d;
const SHADOW = 0x040a07;
const USF_GREEN = 0x006747;
const USF_EVERGREEN = 0x004930;
const USF_GOLD = 0xcfc493;
const GOLD_BRIGHT = 0xe8da9e;
const GOLD_SHADE = 0x9c8f62;
const WALL_MID = 0x1f3a2e;
const WALL_LIGHT = 0x2a4d3d;
const ROOF_DARK = 0x12241c;
const ROOF_MID = 0x1a3328;
const ROOF_TERRACOTTA = 0x7c432e;
const ROOF_TERRACOTTA_HI = 0x9c573c;
const GLASS_DARK = 0x133847;
const GLASS_MID = 0x22687d;
const GLASS_BRIGHT = 0x5cc4d8;
const WIN_WARM = 0xf4d57c;
const WIN_SOFT = 0x9bd6b8;
const GUARD_DARK = 0x381316;
const GUARD_MID = 0x521d22;
const GUARD_LIGHT = 0x70282e;
const GUARD_TRIM = 0xff6b6b;
const GUARD_AMBER = 0xf5b400;

// Reserved top strip inside each building footprint for the crisp nameplate banner,
// so signature roof skylights, domes, antennas, and facades sit 100% unobstructed below.
const PLAQUE_H = 36;

const snap = (n: number) => Math.round(n / 2) * 2;

function rect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  alpha = 1,
) {
  if (w <= 0 || h <= 0) return;
  g.fillStyle(color, alpha).fillRect(snap(x), snap(y), snap(w), snap(h));
}

/**
 * Caua's USF campus terrain (design/js/mapRenderer.js, rendered once to public/sprites/campus-ground.png at 580x364)
 * drawn at 2x under everything, plus the MLK Plaza sprite with the Bull statue and fountain.
 */
export function drawCampusGround(scene: Phaser.Scene, width: number, height: number) {
  scene.add.image(0, 0, "ground").setOrigin(0).setDisplaySize(width, height).setDepth(-1);
  if (scene.textures.exists("mlk-plaza")) scene.add.image(212, 60, "mlk-plaza").setOrigin(0).setScale(2).setDepth(-0.5);
}

function drawWindowRow(
  g: Phaser.GameObjects.Graphics,
  startX: number,
  endX: number,
  y: number,
  winW: number,
  winH: number,
  gap: number,
  color: number,
  skipCenterX?: number,
) {
  for (let wx = startX; wx + winW <= endX; wx += winW + gap) {
    if (skipCenterX !== undefined && Math.abs(wx + winW / 2 - skipCenterX) < 16) continue;
    rect(g, wx - 2, y - 2, winW + 4, winH + 4, INK);
    rect(g, wx, y, winW, winH, color);
    rect(g, wx, y, winW, 2, 0xffffff, 0.35);
  }
}

function drawBaseShell(
  g: Phaser.GameObjects.Graphics,
  b: Building,
  roofColor: number,
  wallColor: number,
  trimColor: number,
  wallHeight = 36,
) {
  const { x, y, w, h } = b;
  const artY = y + PLAQUE_H;
  const wallH = Math.min(snap(wallHeight), snap((h - PLAQUE_H) * 0.55));
  const wallY = y + h - wallH;
  const roofH = wallY - artY;

  // Pixel drop shadow
  rect(g, x + 4, y + 6, w, h, SHADOW, 0.72);
  // Crisp outer ink outline
  rect(g, x - 2, y - 2, w + 4, h + 4, INK);
  // Full base fill behind plaque + roof
  rect(g, x, y, w, wallY - y, roofColor);
  // Side bevel highlights on roof plane
  rect(g, x + 2, artY, 2, roofH, trimColor, 0.35);
  rect(g, x + w - 4, artY, 2, roofH, INK, 0.45);
  // Front wall facade
  rect(g, x, wallY, w, wallH, wallColor);
  // Cornice / overhang ledge separating roof and facade
  rect(g, x, wallY - 2, w, 4, trimColor);
  rect(g, x, wallY + 2, w, 2, INK, 0.75);
  // Ground plinth
  rect(g, x, y + h - 4, w, 4, INK, 0.6);

  return { artY, roofH, wallY, wallH };
}

function drawGenericBuilding(g: Phaser.GameObjects.Graphics, b: Building) {
  const { x, w } = b;
  const roof = b.guarded ? GUARD_DARK : ROOF_MID;
  const wall = b.guarded ? GUARD_MID : WALL_MID;
  const trim = b.guarded ? GUARD_TRIM : 0x7fd1a8;
  const { artY, wallY, wallH } = drawBaseShell(g, b, roof, wall, trim, 36);
  const cx = x + w / 2;

  rect(g, x + 12, artY + 8, w - 24, 6, b.guarded ? GUARD_LIGHT : WALL_LIGHT);
  drawWindowRow(
    g,
    x + 10,
    x + w - 10,
    wallY + 8,
    12,
    Math.max(10, wallH - 18),
    8,
    b.guarded ? 0xff9b9b : WIN_WARM,
    cx,
  );
}

/**
 * Draws a bespoke pixel-art USF building sprite, recessed doorway aligned with `(b.x + b.w/2, b.y + b.h)`,
 * hover highlight, clickable interior zoom trigger, and a crisp top nameplate for building + folder.
 */
export function makeBuilding(
  scene: Phaser.Scene,
  b: Building,
  onSelect: () => void,
  onHover: (over: boolean) => void = () => {},
): {
  body: Phaser.GameObjects.Graphics;
  door: Phaser.GameObjects.Graphics;
  hit: Phaser.GameObjects.Rectangle;
} {
  const body = scene.add.graphics().setDepth(0);
  // Caua's USF sprite (design/mockups-v3) at 2x with a soft drop shadow; drawn art only when no sprite exists.
  const sprite = scene.textures.exists(b.id);
  if (sprite) {
    rect(body, b.x + 6, b.y + b.h - 6, b.w, 10, SHADOW, 0.35);
    scene.add.image(b.x, b.y, b.id).setOrigin(0).setDisplaySize(b.w, b.h).setDepth(0.05);
  } else drawGenericBuilding(body, b);

  // Pixel-art recessed doorway centered at the bottom edge (aligns with waitQueue tethers).
  const dx = snap(b.x + b.w / 2);
  const dy = snap(b.y + b.h);
  const door = scene.add.graphics().setDepth(1.2).setVisible(!sprite);
  const frameColor = b.guarded ? GUARD_TRIM : USF_GOLD;
  rect(door, dx - 12, dy - 18, 24, 18, INK);
  rect(door, dx - 10, dy - 16, 20, 16, frameColor);
  rect(door, dx - 8, dy - 14, 16, 14, 0x0a1611);
  rect(door, dx - 1, dy - 14, 2, 14, frameColor, 0.7);
  rect(door, dx - 4, dy - 8, 2, 2, b.guarded ? GUARD_TRIM : GOLD_BRIGHT);
  rect(door, dx + 2, dy - 8, 2, 2, b.guarded ? GUARD_TRIM : GOLD_BRIGHT);
  rect(door, dx - 10, dy, 20, 2, frameColor, 0.6);

  // Subtle hover outline & full clickable hit box
  const hover = scene.add
    .rectangle(b.x, b.y, b.w, b.h)
    .setOrigin(0)
    .setStrokeStyle(2, 0xffe066, 0.85)
    .setFillStyle(0xffe066, 0.06)
    .setDepth(1.8)
    .setVisible(false);

  const hit = scene.add
    .rectangle(b.x, b.y, b.w, b.h, 0x000000, 0)
    .setOrigin(0)
    .setDepth(0.1)
    .setInteractive({ useHandCursor: true })
    .on("pointerover", () => (hover.setVisible(true), onHover(true)))
    .on("pointerout", () => (hover.setVisible(false), onHover(false)))
    .on("pointerdown", onSelect);

  // Name plate above the roof, folder small under the name.
  const folder = b.folder === null ? "unmapped" : b.folder || "/";
  const cx = b.x + b.w / 2;
  scene.add
    .text(cx, b.y - 14, b.name, { fontFamily: "monospace", fontSize: "13px", fontStyle: "bold", color: "#ffffff", backgroundColor: "#005432", padding: { x: 4, y: 1 } })
    .setOrigin(0.5, 1)
    .setDepth(2);
  scene.add
    .text(cx, b.y - 1, b.guarded ? `${folder} · guarded` : folder, { fontFamily: "monospace", fontSize: "11px", fontStyle: "bold", color: b.guarded ? "#ffd0d0" : "#cfc493", backgroundColor: b.guarded ? "#7a1f24" : "#0d231b", padding: { x: 3, y: 0 } })
    .setOrigin(0.5, 1)
    .setDepth(2);

  return { body, door, hit };
}
