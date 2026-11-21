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
const PLAQUE_H = 26;

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

function drawPalm(g: Phaser.GameObjects.Graphics, cx: number, cy: number) {
  rect(g, cx - 6, cy + 8, 14, 4, SHADOW, 0.55);
  rect(g, cx - 2, cy - 2, 4, 12, 0x5c4631);
  rect(g, cx, cy - 8, 4, 8, 0x73583e);
  rect(g, cx - 10, cy - 12, 10, 4, 0x1e5c3a);
  rect(g, cx + 2, cy - 12, 10, 4, 0x1e5c3a);
  rect(g, cx - 8, cy - 16, 18, 4, 0x2d7a4d);
  rect(g, cx - 4, cy - 18, 10, 4, 0x4ca163);
  rect(g, cx - 12, cy - 8, 6, 4, 0x14452b);
  rect(g, cx + 8, cy - 8, 6, 4, 0x14452b);
}

function drawOak(g: Phaser.GameObjects.Graphics, cx: number, cy: number) {
  rect(g, cx - 10, cy + 4, 22, 6, SHADOW, 0.5);
  rect(g, cx - 2, cy, 6, 8, 0x4a3525);
  rect(g, cx - 12, cy - 10, 26, 14, 0x17442c);
  rect(g, cx - 10, cy - 14, 22, 14, 0x215c3b);
  rect(g, cx - 6, cy - 16, 14, 8, 0x327c4e);
  rect(g, cx - 4, cy - 14, 6, 4, 0x52a367);
}

/**
 * Draws dark-emerald pixel-art USF campus walkways, plaza accents, and perimeter foliage.
 * Lives at depth -1 so buildings, dusk overlay, scaffolds, tethers, and Bulls stay crisp above it.
 */
export function drawCampusGround(
  scene: Phaser.Scene,
  width: number,
  height: number,
  buildings: Building[],
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(-1);

  // Subtle checkerboard turf accents
  for (let y = 16; y < height - 16; y += 48) {
    for (let x = 16; x < width - 16; x += 64) {
      if (((x + y) / 16) % 2 === 0) {
        rect(g, x, y, 28, 18, 0x11241b, 0.7);
      }
    }
  }

  // Main campus stone walkways connecting the 3 columns and 3 rows
  const walkFill = 0x142920;
  const walkEdge = 0x1e3d2f;
  const walkSeam = 0x0f2018;

  const drawPath = (x: number, y: number, w: number, h: number) => {
    rect(g, x - 2, y - 2, w + 4, h + 4, walkEdge);
    rect(g, x, y, w, h, walkFill);
    if (w > h) {
      for (let sx = x + 16; sx < x + w - 8; sx += 24) rect(g, sx, y + 2, 2, h - 4, walkSeam, 0.7);
    } else {
      for (let sy = y + 16; sy < y + h - 8; sy += 24) rect(g, x + 2, sy, w - 4, 2, walkSeam, 0.7);
    }
  };

  // Horizontal corridors between building rows (leaves clear room for Bulls & queues)
  drawPath(72, 212, width - 144, 24);
  drawPath(72, 408, width - 144, 24);

  // Vertical avenues through left, center, and right campus spines
  drawPath(328, 48, 24, height - 96);
  drawPath(608, 48, 24, height - 96);
  drawPath(468, 48, 24, height - 96);

  // Central Bull Runner plaza apron
  const hub = buildings.find((b) => b.id === "bullrunner");
  if (hub) {
    const px = hub.x - 14;
    const py = hub.y - 10;
    const pw = hub.w + 28;
    const ph = hub.h + 24;
    rect(g, px - 2, py - 2, pw + 4, ph + 4, 0x264c3b);
    rect(g, px, py, pw, ph, 0x162d23);
    rect(g, px + 4, py + 4, 6, 6, USF_GOLD, 0.35);
    rect(g, px + pw - 10, py + 4, 6, 6, USF_GOLD, 0.35);
    rect(g, px + 4, py + ph - 10, 6, 6, USF_GOLD, 0.35);
    rect(g, px + pw - 10, py + ph - 10, 6, 6, USF_GOLD, 0.35);
  }

  // Perimeter USF palm trees & oaks positioned strictly in outer margins away from buildings & queues
  const trees: Array<{ kind: "palm" | "oak"; x: number; y: number }> = [
    { kind: "palm", x: 44, y: 66 },
    { kind: "oak", x: 52, y: 180 },
    { kind: "palm", x: 42, y: 318 },
    { kind: "oak", x: 52, y: 492 },
    { kind: "palm", x: 46, y: 586 },
    { kind: "oak", x: width - 48, y: 74 },
    { kind: "palm", x: width - 44, y: 204 },
    { kind: "oak", x: width - 50, y: 342 },
    { kind: "palm", x: width - 44, y: 506 },
    { kind: "oak", x: width - 52, y: 590 },
    { kind: "palm", x: 340, y: 28 },
    { kind: "palm", x: 620, y: 28 },
    { kind: "oak", x: 340, y: height - 22 },
    { kind: "oak", x: 620, y: height - 22 },
  ];

  for (const t of trees) {
    const blocked = buildings.some(
      (b) => t.x > b.x - 24 && t.x < b.x + b.w + 24 && t.y > b.y - 22 && t.y < b.y + b.h + 56,
    );
    if (blocked) continue;
    if (t.kind === "palm") drawPalm(g, t.x, t.y);
    else drawOak(g, t.x, t.y);
  }

  return g;
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

function drawMsc(g: Phaser.GameObjects.Graphics, b: Building) {
  const { x, w } = b;
  const { artY, roofH, wallY, wallH } = drawBaseShell(g, b, ROOF_TERRACOTTA, WALL_MID, USF_GOLD, 38);
  const cx = x + w / 2;

  // Terracotta hipped roof wings + grand vaulted glass skylight atrium
  rect(g, x + 8, artY + 6, 36, roofH - 12, ROOF_MID);
  rect(g, x + 10, artY + 8, 32, 4, ROOF_TERRACOTTA_HI);
  rect(g, x + w - 44, artY + 6, 36, roofH - 12, ROOF_MID);
  rect(g, x + w - 42, artY + 8, 32, 4, ROOF_TERRACOTTA_HI);

  const skyH = Math.max(18, roofH - 10);
  rect(g, cx - 32, artY + 4, 64, skyH, INK);
  rect(g, cx - 30, artY + 6, 60, skyH - 4, GLASS_MID);
  for (let gx = cx - 18; gx <= cx + 18; gx += 12) rect(g, gx, artY + 6, 2, skyH - 4, USF_GOLD);
  rect(g, cx - 30, artY + 6 + snap((skyH - 4) / 2), 60, 2, USF_GOLD);
  rect(g, cx - 28, artY + 8, 18, 4, GLASS_BRIGHT, 0.85);

  // Atrium windows & twin USF green-and-gold banners flanking the double doorway
  drawWindowRow(g, x + 10, x + w - 10, wallY + 8, 12, Math.max(10, wallH - 18), 8, WIN_WARM, cx);
  rect(g, cx - 22, wallY + 6, 6, 16, USF_GREEN);
  rect(g, cx - 20, wallY + 8, 2, 12, USF_GOLD);
  rect(g, cx + 16, wallY + 6, 6, 16, USF_GREEN);
  rect(g, cx + 18, wallY + 8, 2, 12, USF_GOLD);
}

function drawLibrary(g: Phaser.GameObjects.Graphics, b: Building) {
  const { x, w } = b;
  const { artY, roofH, wallY, wallH } = drawBaseShell(g, b, ROOF_MID, WALL_LIGHT, USF_GOLD, 42);
  const cx = x + w / 2;

  // Stepped Tampa Library mechanical penthouse roof
  rect(g, x + 12, artY + 4, w - 24, roofH - 10, ROOF_DARK);
  rect(g, x + 26, artY + 8, w - 52, roofH - 18, WALL_MID);
  rect(g, x + 28, artY + 10, w - 56, 4, USF_GOLD, 0.65);

  // Vertical ribbed limestone pilasters & warm reading-room windows
  for (let px = x + 10; px < x + w - 8; px += 14) {
    if (Math.abs(px - cx) < 16) continue;
    rect(g, px, wallY + 4, 4, wallH - 8, USF_GOLD, 0.6);
    rect(g, px + 6, wallY + 8, 6, Math.max(10, wallH - 18), WIN_WARM);
  }
  // Open-book transom emblem centered above the entrance
  rect(g, cx - 10, wallY + 6, 8, 6, GOLD_BRIGHT);
  rect(g, cx + 2, wallY + 6, 8, 6, GOLD_BRIGHT);
  rect(g, cx - 2, wallY + 8, 4, 4, INK);
}

function drawEnb(g: Phaser.GameObjects.Graphics, b: Building) {
  const { x, w } = b;
  const { artY, roofH, wallY, wallH } = drawBaseShell(g, b, 0x16292e, 0x1b3438, 0x7fd1a8, 36);
  const cx = x + w / 2;

  // Rooftop HVAC chiller units + comms mast with live green beacon
  const unitH = Math.max(14, roofH - 16);
  rect(g, x + 12, artY + 6, 28, unitH, 0x29484d);
  rect(g, x + 16, artY + 10, 20, Math.max(6, unitH - 8), INK);
  rect(g, x + 20, artY + 12, 12, Math.max(4, unitH - 12), 0x4b777d);

  rect(g, x + w - 42, artY + 6, 28, unitH, 0x29484d);
  rect(g, x + w - 38, artY + 10, 20, Math.max(6, unitH - 8), INK);
  rect(g, x + w - 34, artY + 12, 12, Math.max(4, unitH - 12), 0x7fd1a8, 0.45);

  rect(g, cx - 2, artY + 8, 4, roofH - 12, 0xcad2d8);
  rect(g, cx - 10, artY + 14, 20, 2, 0xcad2d8);
  rect(g, cx - 2, artY + 4, 4, 4, 0x4ade80);

  // Horizontal tech ribbon window band
  const bandH = Math.max(10, Math.min(16, wallH - 18));
  rect(g, x + 8, wallY + 8, w - 16, bandH + 4, INK);
  rect(g, x + 10, wallY + 10, w - 20, bandH, GLASS_MID);
  for (let gx = x + 14; gx < x + w - 18; gx += 18) {
    if (Math.abs(gx - cx) < 14) continue;
    rect(g, gx, wallY + 12, 10, bandH - 4, GLASS_BRIGHT, 0.8);
  }
  rect(g, cx - 14, wallY + 8, 28, wallH - 8, 0x1b3438);
}

function drawEnc(g: Phaser.GameObjects.Graphics, b: Building) {
  const { x, w } = b;
  const { artY, roofH, wallY, wallH } = drawBaseShell(g, b, 0x152b29, 0x1b3834, 0x6ee7b7, 36);
  const cx = x + w / 2;

  // 3 sawtooth engineering lab roof skylights
  const bayW = snap((w - 24) / 3);
  for (let i = 0; i < 3; i++) {
    const bx = x + 12 + i * bayW;
    rect(g, bx, artY + 6, bayW - 6, roofH - 12, 0x1f3f3a);
    rect(g, bx + 2, artY + 8, bayW - 10, 6, GLASS_BRIGHT, 0.85);
    rect(g, bx + 2, artY + 14, bayW - 10, 2, INK);
  }

  drawWindowRow(g, x + 10, x + w - 10, wallY + 8, 14, Math.max(10, wallH - 18), 8, WIN_SOFT, cx);
}

function drawMuma(g: Phaser.GameObjects.Graphics, b: Building) {
  const { x, w } = b;
  const { artY, roofH, wallY, wallH } = drawBaseShell(g, b, 0x172830, 0x203740, GOLD_BRIGHT, 38);
  const cx = x + w / 2;

  // Executive glass atrium roof wedge + USF gold architectural ribs
  rect(g, x + 10, artY + 4, w - 20, roofH - 10, 0x112026);
  rect(g, x + w - 64, artY + 6, 50, roofH - 14, GLASS_MID);
  rect(g, x + w - 60, artY + 8, 42, 6, GLASS_BRIGHT, 0.85);
  rect(g, x + 16, artY + 10, w - 88, 4, USF_GOLD, 0.55);
  rect(g, x + 16, artY + 20, w - 88, 4, USF_GOLD, 0.4);

  drawWindowRow(g, x + 10, x + w - 10, wallY + 8, 16, Math.max(10, wallH - 18), 6, GLASS_BRIGHT, cx);
}

function drawCooper(g: Phaser.GameObjects.Graphics, b: Building) {
  const { x, w } = b;
  const { artY, roofH, wallY, wallH } = drawBaseShell(g, b, 0x5c3426, 0x2c3c2f, USF_GOLD, 38);
  const cx = x + w / 2;

  // Classic pitched gabled roof ridge & shingle texture
  rect(g, x + 6, artY + snap(roofH / 2) - 2, w - 12, 4, ROOF_TERRACOTTA_HI);
  for (let rx = x + 14; rx < x + w - 18; rx += 22) {
    rect(g, rx, artY + 6, 10, 4, 0x452419, 0.75);
    rect(g, rx + 8, artY + roofH - 10, 10, 4, 0x452419, 0.75);
  }
  // Twin pedimented limestone columns flanking the doorway
  rect(g, cx - 18, wallY + 4, 4, wallH - 6, USF_GOLD);
  rect(g, cx + 14, wallY + 4, 4, wallH - 6, USF_GOLD);
  drawWindowRow(g, x + 10, x + w - 10, wallY + 8, 10, Math.max(10, wallH - 18), 8, WIN_WARM, cx);
}

function drawRec(g: Phaser.GameObjects.Graphics, b: Building) {
  const { x, w } = b;
  const { artY, roofH, wallY, wallH } = drawBaseShell(g, b, 0x16362c, 0x1d4235, 0x9ccb3b, 28);
  const cx = x + w / 2;

  // Barrel-vaulted athletic roof ribs with skylight strips
  for (let rx = x + 14; rx < x + w - 14; rx += 22) {
    rect(g, rx, artY + 2, 4, roofH - 6, 0x2c6652);
    rect(g, rx + 6, artY + 6, 10, Math.max(8, roofH - 14), GLASS_MID, 0.6);
  }
  rect(g, x + 12, artY + snap(roofH / 2) - 2, w - 24, 4, 0x9ccb3b, 0.65);

  drawWindowRow(g, x + 12, x + w - 12, wallY + 6, 18, Math.max(8, wallH - 14), 8, GLASS_BRIGHT, cx);
}

function drawSunDome(g: Phaser.GameObjects.Graphics, b: Building) {
  const { x, w } = b;
  const { artY, roofH, wallY, wallH } = drawBaseShell(g, b, GUARD_DARK, GUARD_MID, GUARD_TRIM, 34);
  const cx = x + w / 2;
  const cy = artY + snap(roofH / 2);

  // Iconic USF Sun Dome stepped geodesic dome + crimson/gold security vault cues
  const rW = snap(w - 28);
  const rH = Math.max(24, snap(roofH - 8));
  rect(g, cx - rW / 2 + 8, cy - rH / 2, rW - 16, rH, GUARD_LIGHT);
  rect(g, cx - rW / 2, cy - rH / 2 + 4, rW, rH - 8, GUARD_LIGHT);
  rect(g, cx - rW / 2 + 16, cy - rH / 2 + 4, rW - 32, rH - 8, 0x8a343b);
  // Radial dome ribs in USF gold
  rect(g, cx - 2, cy - rH / 2 + 2, 4, rH - 4, USF_GOLD, 0.8);
  rect(g, cx - rW / 2 + 4, cy - 2, rW - 8, 4, USF_GOLD, 0.8);
  // Central crown oculus
  rect(g, cx - 14, cy - 8, 28, 16, INK);
  rect(g, cx - 12, cy - 6, 24, 12, GUARD_AMBER, 0.9);
  rect(g, cx - 6, cy - 4, 12, 8, GUARD_TRIM);

  // Corner security beacons
  rect(g, x + 6, artY + 4, 6, 6, GUARD_TRIM);
  rect(g, x + w - 12, artY + 4, 6, 6, GUARD_TRIM);

  // Caution hazard stripe & armored slit windows along vault wall
  for (let hx = x + 6; hx < x + w - 10; hx += 12) {
    if (Math.abs(hx - cx) < 16) continue;
    rect(g, hx, wallY + 4, 6, 4, GUARD_AMBER);
  }
  drawWindowRow(g, x + 12, x + w - 12, wallY + 12, 10, Math.max(8, wallH - 18), 10, 0xff9b9b, cx);
}

function drawJuniper(g: Phaser.GameObjects.Graphics, b: Building) {
  const { x, w } = b;
  const { artY, roofH, wallY, wallH } = drawBaseShell(g, b, 0x26382c, WALL_MID, GOLD_SHADE, 38);
  const cx = x + w / 2;

  // U-wing residence hall roof with recessed green courtyard garden
  rect(g, x + 6, artY + 2, w - 12, 6, ROOF_TERRACOTTA);
  rect(g, cx - 30, artY + 10, 60, roofH - 14, 0x154028);
  rect(g, cx - 26, artY + 14, 52, Math.max(10, roofH - 22), 0x1f5c3a);
  rect(g, cx - 6, artY + snap(roofH / 2), 12, 6, USF_GOLD, 0.6);

  drawWindowRow(g, x + 10, x + w - 10, wallY + 8, 10, Math.max(10, wallH - 18), 6, WIN_WARM, cx);
}

function drawBullRunner(g: Phaser.GameObjects.Graphics, b: Building) {
  const { x, y, w, h } = b;
  const artY = y + PLAQUE_H;
  const artH = h - PLAQUE_H;

  // Drop shadow & crisp outline
  rect(g, x + 4, y + 6, w, h, SHADOW, 0.65);
  rect(g, x - 2, y - 2, w + 4, h + 4, INK);
  rect(g, x, y, w, h, 0x152921);

  // Yellow bus-bay curb stripes along bottom edge
  for (let sx = x + 6; sx < x + w - 10; sx += 16) {
    rect(g, sx, y + h - 6, 10, 4, 0xdbe442, 0.85);
  }

  // USF Green & Gold transit shelter canopy
  const canopyH = snap(artH * 0.42);
  rect(g, x + 4, artY + 2, w - 8, canopyH, INK);
  rect(g, x + 6, artY + 4, w - 12, canopyH - 4, USF_EVERGREEN);
  rect(g, x + 6, artY + 4, w - 12, 6, USF_GREEN);
  for (let rx = x + 16; rx < x + w - 14; rx += 22) {
    rect(g, rx, artY + 10, 4, Math.max(4, canopyH - 10), USF_GOLD, 0.7);
  }
  rect(g, x + 6, artY + canopyH, w - 12, 4, USF_GOLD);

  // Canopy posts
  rect(g, x + 12, artY + canopyH + 4, 4, artH - canopyH - 12, USF_GOLD);
  rect(g, x + w - 16, artY + canopyH + 4, 4, artH - canopyH - 12, USF_GOLD);

  // Glowing Bull Runner route sign on left
  rect(g, x + 22, artY + canopyH + 8, 12, 16, INK);
  rect(g, x + 24, artY + canopyH + 10, 8, 10, USF_GREEN);
  rect(g, x + 26, artY + canopyH + 12, 4, 4, 0xdbe442);

  // Pixel-art USF Bull Runner mini shuttle parked neatly at the curb
  const bx = x + w - 62;
  const by = y + h - 24;
  rect(g, bx - 2, by - 2, 44, 18, INK);
  rect(g, bx, by, 40, 14, USF_GREEN);
  rect(g, bx, by + 10, 40, 4, USF_GOLD);
  rect(g, bx + 4, by + 2, 8, 6, GLASS_BRIGHT);
  rect(g, bx + 14, by + 2, 8, 6, GLASS_BRIGHT);
  rect(g, bx + 24, by + 2, 12, 6, GLASS_BRIGHT);
  rect(g, bx + 38, by + 10, 2, 4, 0xfff3a1);
  rect(g, bx + 6, by + 14, 6, 4, INK);
  rect(g, bx + 28, by + 14, 6, 4, INK);
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
): {
  body: Phaser.GameObjects.Graphics;
  door: Phaser.GameObjects.Graphics;
  hit: Phaser.GameObjects.Rectangle;
} {
  const body = scene.add.graphics().setDepth(0);

  switch (b.id) {
    case "msc":
      drawMsc(body, b);
      break;
    case "library":
      drawLibrary(body, b);
      break;
    case "enb":
      drawEnb(body, b);
      break;
    case "enc":
      drawEnc(body, b);
      break;
    case "muma":
      drawMuma(body, b);
      break;
    case "cooper":
      drawCooper(body, b);
      break;
    case "rec":
      drawRec(body, b);
      break;
    case "sundome":
      drawSunDome(body, b);
      break;
    case "juniper":
      drawJuniper(body, b);
      break;
    case "bullrunner":
      drawBullRunner(body, b);
      break;
    default:
      drawGenericBuilding(body, b);
      break;
  }

  // Pixel-art recessed doorway centered at the bottom edge (aligns with waitQueue tethers).
  const dx = snap(b.x + b.w / 2);
  const dy = snap(b.y + b.h);
  const door = scene.add.graphics().setDepth(1.2);
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
    .on("pointerover", () => hover.setVisible(true))
    .on("pointerout", () => hover.setVisible(false))
    .on("pointerdown", onSelect);

  // Crisp 26px top nameplate bar integrated cleanly into the upper roof rim
  const folder = b.folder === null ? "unmapped" : b.folder || "/";
  const plaque = scene.add.graphics().setDepth(1.9);
  rect(plaque, b.x, b.y, b.w, PLAQUE_H, 0x08140f, 0.9);
  rect(plaque, b.x, b.y, b.w, 2, b.guarded ? GUARD_TRIM : 0x7fd1a8, 0.95);
  rect(plaque, b.x, b.y + PLAQUE_H - 2, b.w, 2, INK, 0.95);

  scene.add
    .text(b.x + 8, b.y + 3, b.name, {
      fontFamily: "monospace",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#ffffff",
    })
    .setDepth(2);

  scene.add
    .text(b.x + 8, b.y + 14, b.guarded ? `${folder} [GUARDED]` : folder, {
      fontFamily: "monospace",
      fontSize: "10px",
      fontStyle: "bold",
      color: b.guarded ? "#fca5a5" : "#86efac",
    })
    .setDepth(2);

  return { body, door, hit };
}
