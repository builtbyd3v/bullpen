/* ============================================================================
   BULLPEN — Pixel Art Sprite & Animation Engine
   All coordinates snapped to integer pixels for razor-sharp pixel art.
   ============================================================================ */

window.BullpenSprites = (function () {
  const { USF, CLAUDE_MODELS } = window.BullpenPalette;

  // Helper: snap to integer pixel rect
  function px(ctx, x, y, w, h, color) {
    if (color) ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  // Crisp 3x5 / 4x5 micro pixel font for canvas badges (ultra legible on 512x350!)
  const MICRO_FONT = {
    'A': ['010','101','111','101','101'],
    'B': ['110','101','110','101','110'],
    'C': ['011','100','100','100','011'],
    'D': ['110','101','101','101','110'],
    'E': ['111','100','110','100','111'],
    'F': ['111','100','110','100','100'],
    'G': ['011','100','101','101','011'],
    'H': ['101','101','111','101','101'],
    'I': ['111','010','010','010','111'],
    'J': ['001','001','001','101','010'],
    'K': ['101','101','110','101','101'],
    'L': ['100','100','100','100','111'],
    'M': ['101','111','111','101','101'],
    'N': ['110','101','101','101','101'],
    'O': ['010','101','101','101','010'],
    'P': ['110','101','110','100','100'],
    'Q': ['010','101','101','111','011'],
    'R': ['110','101','110','101','101'],
    'S': ['011','100','010','001','110'],
    'T': ['111','010','010','010','010'],
    'U': ['101','101','101','101','111'],
    'V': ['101','101','101','101','010'],
    'W': ['101','101','111','111','101'],
    'X': ['101','101','010','101','101'],
    'Y': ['101','101','010','010','010'],
    'Z': ['111','001','010','100','111'],
    '0': ['111','101','101','101','111'],
    '1': ['010','110','010','010','111'],
    '2': ['110','001','010','100','111'],
    '3': ['110','001','010','001','110'],
    '4': ['101','101','111','001','001'],
    '5': ['111','100','110','001','110'],
    '6': ['011','100','111','101','111'],
    '7': ['111','001','010','010','010'],
    '8': ['111','101','111','101','111'],
    '9': ['111','101','111','001','110'],
    '/': ['001','001','010','100','100'],
    '-': ['000','000','111','000','000'],
    '!': ['010','010','010','000','010'],
    '.': ['000','000','000','000','010'],
    ':': ['000','010','000','010','000'],
    ' ': ['000','000','000','000','000'],
    '_': ['000','000','000','000','111'],
    '+': ['000','010','111','010','000'],
  };

  function drawPixelText(ctx, text, x, y, color, align = 'left', shadowColor = null) {
    const str = String(text).toUpperCase();
    const charW = 4;
    const totalW = str.length * charW - 1;
    let startX = Math.round(x);
    if (align === 'center') startX = Math.round(x - totalW / 2);
    if (align === 'right') startX = Math.round(x - totalW);
    const startY = Math.round(y);

    for (let i = 0; i < str.length; i++) {
      const glyph = MICRO_FONT[str[i]] || MICRO_FONT[' '];
      const gx = startX + i * charW;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
          if (glyph[r][c] === '1') {
            if (shadowColor) {
              ctx.fillStyle = shadowColor;
              ctx.fillRect(gx + c + 1, startY + r + 1, 1, 1);
            }
            ctx.fillStyle = color;
            ctx.fillRect(gx + c, startY + r, 1, 1);
          }
        }
      }
    }
    return totalW;
  }

  // Pixel badge pill (e.g. building code tag or status tag)
  function drawPixelPill(ctx, text, cx, y, bg, fg, border = USF.ink) {
    const str = String(text).toUpperCase();
    const tw = str.length * 4 - 1;
    const pw = tw + 6;
    const ph = 9;
    const lx = Math.round(cx - pw / 2);
    const ty = Math.round(y);

    px(ctx, lx, ty, pw, ph, border);
    px(ctx, lx + 1, ty + 1, pw - 2, ph - 2, bg);
    drawPixelText(ctx, str, cx, ty + 2, fg, 'center');
  }

  // ==========================================================================
  // PIXEL TREE (Classic USF campus oak / palm)
  // ==========================================================================
  function drawPixelTree(ctx, x, y, variant = 0) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    // Ground shadow
    px(ctx, ix - 2, iy + 2, 6, 2, 'rgba(0,56,34,0.28)');
    // Trunk
    px(ctx, ix, iy, 2, 3, '#6D5236');
    // Canopy
    const cDark = variant % 2 === 0 ? '#2C6B3F' : '#005432';
    const cMid  = variant % 2 === 0 ? '#468C4D' : '#006747';
    const cTop  = variant % 2 === 0 ? '#85B85B' : '#9CCB3B';
    px(ctx, ix - 3, iy - 4, 8, 5, cDark);
    px(ctx, ix - 2, iy - 5, 6, 5, cMid);
    px(ctx, ix - 1, iy - 6, 4, 2, cTop);
    px(ctx, ix - 2, iy - 4, 2, 2, cTop);
  }

  // ==========================================================================
  // INTERACTIVE PIXEL BUILDING (Custom USF architectural silhouettes!)
  // ==========================================================================
  function drawInteractiveBuilding(ctx, b, opts) {
    const { hovered, selected, status, time } = opts;
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    const w = Math.round(b.w);
    const h = Math.round(b.h);

    // 1. Highlight glow / status perimeter
    if (status === 'conflict') {
      const pulse = Math.floor(time * 8) % 2 === 0;
      px(ctx, x - 3, y - 3, w + 6, h + 6, pulse ? USF.alertRed : USF.lemongrass);
    } else if (hovered || selected) {
      px(ctx, x - 2, y - 2, w + 4, h + 4, hovered ? USF.lemongrass : USF.gold);
      px(ctx, x - 1, y - 1, w + 2, h + 2, USF.green);
    } else if (status === 'working') {
      px(ctx, x - 2, y - 2, w + 4, h + 4, USF.craneGold);
    } else if (status === 'ribbon') {
      px(ctx, x - 2, y - 2, w + 4, h + 4, USF.apple);
    }

    // 2. Drop shadow (south-east pixel depth)
    px(ctx, x + 2, y + 3, w, h, 'rgba(0, 56, 34, 0.45)');

    // 3. Base architectural silhouette by building style
    if (b.roofStyle === 'dome') {
      // SUN DOME (Yuengling Center): Iconic octagonal domed roof + circular SSP annex
      const cx = x + Math.floor(w / 2);
      const cy = y + Math.floor(h / 2) - 2;
      // Outer octagon silhouette
      px(ctx, x + 4, y, w - 8, h - 6, USF.ink);
      px(ctx, x, y + 4, w, h - 14, USF.ink);
      px(ctx, x + 5, y + 1, w - 10, h - 8, USF.bldgDark);
      px(ctx, x + 1, y + 5, w - 2, h - 16, USF.bldgMid);
      // Ribbed USF dome crown
      px(ctx, x + 6, y + 3, w - 12, h - 14, USF.sand);
      px(ctx, x + 10, y + 5, w - 20, h - 18, USF.white);
      // Dome ribs
      px(ctx, cx - 1, y + 2, 2, h - 12, USF.gold);
      px(ctx, x + 4, cy - 1, w - 8, 2, USF.gold);
      // USF Green ring trim around dome
      px(ctx, x + 8, y + 4, w - 16, 1, USF.green);
      px(ctx, x + 8, y + h - 12, w - 16, 1, USF.green);
      // SSP circular south annex
      px(ctx, cx - 8, y + h - 9, 16, 9, USF.ink);
      px(ctx, cx - 7, y + h - 8, 14, 7, USF.bldgMid);
      px(ctx, cx - 5, y + h - 7, 10, 4, USF.bldgLight);
    } else if (b.roofStyle === 'marshall') {
      // MSC (Marshall Student Center): U-shaped plaza union + USF green skylight
      px(ctx, x, y, w, h, USF.ink);
      px(ctx, x + 1, y + 1, w - 2, h - 2, USF.bldgDark);
      px(ctx, x + 1, y + 1, w - 2, h - 6, USF.bldgMid);
      // Raised roof wings
      px(ctx, x + 2, y + 2, w - 4, 8, USF.bldgLight);
      px(ctx, x + 2, y + 2, 10, h - 7, USF.bldgLight);
      px(ctx, x + w - 12, y + 2, 10, h - 7, USF.bldgLight);
      // Central glass atrium & USF green entrance awning
      px(ctx, x + 13, y + 10, w - 26, 9, USF.storm);
      px(ctx, x + 14, y + 11, w - 28, 3, USF.sky);
      px(ctx, x + 12, y + h - 5, w - 24, 3, USF.green);
      // Windows
      for (let wx = x + 4; wx < x + w - 5; wx += 4) {
        px(ctx, wx, y + h - 4, 2, 2, USF.slate);
      }
    } else if (b.roofStyle === 'engineering') {
      // ENB (Engineering Building II): Modern wing + skybridge + roof HVAC units
      px(ctx, x, y, w, h, USF.ink);
      px(ctx, x + 1, y + 1, w - 2, h - 2, USF.bldgDark);
      px(ctx, x + 1, y + 1, w - 2, h - 6, USF.bldgMid);
      px(ctx, x + 2, y + 2, w - 4, h - 9, USF.bldgLight);
      // East skybridge wing
      px(ctx, x + w - 10, y + 5, 9, 8, USF.bldgMid);
      // Rooftop HVAC & solar array detail
      px(ctx, x + 5, y + 4, 6, 4, USF.silver);
      px(ctx, x + 13, y + 4, 5, 4, USF.gray);
      px(ctx, x + 22, y + 4, 10, 5, USF.storm);
      px(ctx, x + 23, y + 5, 8, 3, USF.sky);
      // Banded tech windows
      for (let wx = x + 3; wx < x + w - 4; wx += 4) {
        px(ctx, wx, y + h - 5, 3, 2, USF.evergreen);
      }
    } else if (b.roofStyle === 'library') {
      // LIB (USF Tampa Library): Iconic tall rectangular tower with vertical fins
      px(ctx, x, y - 3, w, h + 3, USF.ink);
      px(ctx, x + 1, y - 2, w - 2, h + 1, USF.bldgDark);
      px(ctx, x + 1, y - 2, w - 2, h - 5, USF.sand);
      // Roof skylight bar
      px(ctx, x + 4, y, w - 8, 5, USF.gold);
      px(ctx, x + 6, y + 1, w - 12, 3, USF.seaglass);
      // Vertical concrete facade fins + warm glowing study windows
      for (let fx = x + 3; fx < x + w - 3; fx += 4) {
        px(ctx, fx, y + 7, 2, h - 9, USF.bldgLight);
        px(ctx, fx + 2, y + 8, 2, 2, USF.lemongrass);
        px(ctx, fx + 2, y + 12, 2, 2, USF.sky);
      }
      // USF Green main entrance
      px(ctx, x + Math.floor(w / 2) - 4, y + h - 4, 8, 3, USF.green);
    } else if (b.roofStyle === 'courtyard') {
      // BSN (Muma Business): Square with green central courtyard
      px(ctx, x, y, w, h, USF.ink);
      px(ctx, x + 1, y + 1, w - 2, h - 2, USF.bldgDark);
      px(ctx, x + 1, y + 1, w - 2, h - 5, USF.bldgLight);
      // Inner courtyard garden
      px(ctx, x + 8, y + 7, w - 16, h - 15, USF.evergreen);
      px(ctx, x + 9, y + 8, w - 18, h - 17, USF.apple);
      px(ctx, x + 12, y + 11, 4, 4, USF.sand);
    } else {
      // ISA, REC, FAH
      px(ctx, x, y, w, h, USF.ink);
      px(ctx, x + 1, y + 1, w - 2, h - 2, USF.bldgDark);
      px(ctx, x + 1, y + 1, w - 2, h - 5, USF.bldgMid);
      px(ctx, x + 3, y + 2, w - 6, h - 8, USF.bldgLight);
      px(ctx, x + 6, y + 4, w - 12, 4, USF.seaglass);
      for (let wx = x + 3; wx < x + w - 4; wx += 4) {
        px(ctx, wx, y + h - 4, 2, 2, USF.slate);
      }
    }

    // 4. Guarded Zone shield emblem (e.g. SUN /database)
    if (b.guarded) {
      const sx = x + w - 7;
      const sy = y - 2;
      px(ctx, sx, sy, 8, 9, USF.ink);
      px(ctx, sx + 1, sy + 1, 6, 6, USF.green);
      px(ctx, sx + 2, sy + 7, 4, 1, USF.green);
      px(ctx, sx + 3, sy + 2, 2, 4, USF.lemongrass);
      px(ctx, sx + 2, sy + 3, 4, 1, USF.lemongrass);
    }

    // 5. Building code plaque + primary gold accent
    const pillBg = status === 'conflict'
      ? USF.alertRed
      : (status === 'working' ? USF.evergreen : (b.primary ? USF.green : USF.slate));
    const pillFg = status === 'conflict' ? USF.white : (b.primary ? USF.gold : USF.sand);
    drawPixelPill(ctx, b.code, x + w / 2, y + h - 2, pillBg, pillFg);
  }

  // ==========================================================================
  // CONSTRUCTION SITE FX (Cones, Scaffolding, Animated Crane, Caution Tape!)
  // ==========================================================================
  function drawConstructionSite(ctx, b, time) {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    const w = Math.round(b.w);
    const h = Math.round(b.h);

    // 1. Yellow/black hazard tape strip along the bottom front
    for (let tx = x - 3; tx < x + w + 2; tx += 4) {
      px(ctx, tx, y + h + 1, 2, 2, USF.craneGold);
      px(ctx, tx + 2, y + h + 1, 2, 2, USF.ink);
    }

    // 2. Pixel Scaffolding wrapping building facade
    const scafColor = USF.silver;
    const scafDark  = USF.slate;
    // Vertical poles
    for (let sx = x - 1; sx <= x + w; sx += 9) {
      px(ctx, sx, y - 3, 1, h + 3, scafDark);
      px(ctx, sx + 1, y - 3, 1, h + 3, scafColor);
    }
    // Horizontal planks + diagonal cross-braces
    const levels = [y + 1, y + Math.floor(h * 0.5), y + h - 4];
    levels.forEach(ly => {
      px(ctx, x - 2, ly, w + 4, 2, USF.bldgDark);
      px(ctx, x - 2, ly, w + 4, 1, USF.gold);
    });
    // Cross X-bracing pixels
    for (let i = 0; i < 6; i++) {
      px(ctx, x + 2 + i, y + 3 + i, 1, 1, scafColor);
      px(ctx, x + 8 - i, y + 3 + i, 1, 1, scafColor);
      px(ctx, x + w - 9 + i, y + 3 + i, 1, 1, scafColor);
      px(ctx, x + w - 3 - i, y + 3 + i, 1, 1, scafColor);
    }

    // 3. Orange Traffic Cones around perimeter
    const cones = [
      [x - 6, y + h - 1],
      [x + w + 2, y + h - 1],
      [x - 6, y + 2],
      [x + Math.floor(w / 2) - 10, y + h + 3],
      [x + Math.floor(w / 2) + 8, y + h + 3],
    ];
    cones.forEach(([cx, cy]) => {
      px(ctx, cx - 1, cy + 3, 5, 1, USF.ink);
      px(ctx, cx,     cy + 2, 3, 2, USF.coneOrange);
      px(ctx, cx,     cy + 1, 3, 1, USF.white); // reflective white stripe!
      px(ctx, cx + 1, cy,     1, 1, USF.coneOrange);
    });

    // 4. Animated Pixel Construction Crane beside the building!
    const craneX = x + w + 4;
    const craneBaseY = y + h;
    const towerH = 34;
    const topY = craneBaseY - towerH;

    // Crane concrete base
    px(ctx, craneX - 2, craneBaseY - 2, 8, 4, USF.slate);
    px(ctx, craneX - 1, craneBaseY - 1, 6, 2, USF.silver);

    // Lattice mast tower
    px(ctx, craneX, topY, 1, towerH - 2, USF.ink);
    px(ctx, craneX + 3, topY, 1, towerH - 2, USF.ink);
    px(ctx, craneX + 1, topY, 2, towerH - 2, USF.craneGold);
    for (let ty = topY + 2; ty < craneBaseY - 3; ty += 4) {
      px(ctx, craneX + 1, ty, 2, 1, USF.ink);
    }

    // Operator cab
    px(ctx, craneX - 2, topY + 4, 6, 4, USF.ink);
    px(ctx, craneX - 1, topY + 5, 4, 2, USF.sky);

    // Horizontal jib arm extending LEFT over the building + counterweight RIGHT
    const jibLeft = x + 2;
    const jibRight = craneX + 11;
    px(ctx, jibLeft, topY - 1, jibRight - jibLeft, 3, USF.ink);
    px(ctx, jibLeft + 1, topY, jibRight - jibLeft - 2, 1, USF.craneGold);
    // Counterweight block on right
    px(ctx, jibRight - 4, topY - 1, 5, 4, USF.slate);
    px(ctx, jibRight - 3, topY, 3, 2, USF.silver);
    // Apex mast & guy wires
    px(ctx, craneX + 1, topY - 5, 2, 5, USF.craneGold);
    px(ctx, craneX - 5, topY - 3, 6, 1, USF.ink);
    px(ctx, craneX + 3, topY - 3, 5, 1, USF.ink);

    // Animated trolley sliding back and forth along jib + swinging steel beam!
    const swing = (Math.sin(time * 2.2) + 1) * 0.5; // 0..1
    const trolleyX = Math.round(jibLeft + 4 + swing * Math.max(6, (craneX - jibLeft - 10)));
    const cableLen = Math.round(7 + Math.sin(time * 3.1) * 3);
    px(ctx, trolleyX - 1, topY + 2, 4, 2, USF.ink);
    // Cable
    px(ctx, trolleyX, topY + 4, 1, cableLen, USF.ink);
    // Hook & lifted gold beam
    const hookY = topY + 4 + cableLen;
    px(ctx, trolleyX - 1, hookY, 3, 2, USF.coneOrange);
    px(ctx, trolleyX - 4, hookY + 2, 9, 2, USF.ink);
    px(ctx, trolleyX - 3, hookY + 2, 7, 1, USF.gold);

    // 5. Twinkling pixel welding sparks / dust puffs
    const sparkPhase = Math.floor(time * 10);
    for (let s = 0; s < 3; s++) {
      if ((sparkPhase + s) % 3 === 0) {
        const sx = x + ((s * 13 + sparkPhase * 5) % Math.max(8, w - 4));
        const sy = y + ((s * 7 + sparkPhase * 3) % Math.max(6, h - 4));
        px(ctx, sx, sy, 2, 2, s % 2 === 0 ? USF.lemongrass : USF.white);
      }
    }
  }

  // ==========================================================================
  // RIBBON-CUTTING TRANSITION FX (Ribbon, Golden Scissors, Confetti, Banner!)
  // progress: 0.0 -> 1.0 over ~3.6 seconds
  // ==========================================================================
  function drawRibbonCutting(ctx, b, progress) {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    const w = Math.round(b.w);
    const h = Math.round(b.h);
    const cx = Math.round(x + w / 2);
    const ribbonY = Math.round(y + h * 0.55);

    // Gold stanchion posts on both sides of building
    const leftPost = x - 5;
    const rightPost = x + w + 3;
    const postAlpha = progress < 0.85 ? 1 : Math.max(0, (1 - progress) / 0.15);
    ctx.save();
    ctx.globalAlpha = postAlpha;

    [leftPost, rightPost].forEach(postX => {
      px(ctx, postX, ribbonY - 2, 3, 9, USF.ink);
      px(ctx, postX + 1, ribbonY - 1, 1, 7, USF.gold);
      px(ctx, postX, ribbonY - 3, 3, 2, USF.lemongrass);
    });

    const cutAt = 0.34; // moment scissors snip the ribbon!

    if (progress < cutAt) {
      // Intact ceremonial crimson & USF gold ribbon stretched across building
      px(ctx, leftPost + 2, ribbonY - 1, rightPost - leftPost - 2, 5, USF.ink);
      px(ctx, leftPost + 2, ribbonY, rightPost - leftPost - 2, 3, USF.ribbonRed);
      px(ctx, leftPost + 2, ribbonY + 1, rightPost - leftPost - 2, 1, USF.gold);

      // Golden pixel scissors gliding toward center
      const t = progress / cutAt;
      const scX = Math.round(leftPost + (cx - leftPost - 2) * t);
      const scY = ribbonY - 7 + Math.round(t * 4);
      const bladesOpen = Math.floor(progress * 24) % 2 === 0;
      drawPixelScissors(ctx, scX, scY, bladesOpen);
    } else {
      // SNIPPED! Ribbon halves flutter outward & downward!
      const after = (progress - cutAt) / (1 - cutAt); // 0..1
      const gap = Math.round(2 + after * 12);
      const droop = Math.round(after * 8);

      // Left half fluttering left
      const leftLen = Math.max(2, (cx - leftPost - 2) - gap);
      px(ctx, leftPost + 2, ribbonY + Math.floor(droop * 0.4), leftLen, 3, USF.ribbonRed);
      px(ctx, leftPost + 2, ribbonY + Math.floor(droop * 0.4) + 1, leftLen, 1, USF.gold);

      // Right half fluttering right
      const rightStart = cx + gap;
      const rightLen = Math.max(2, rightPost - rightStart);
      px(ctx, rightStart, ribbonY + Math.floor(droop * 0.4), rightLen, 3, USF.ribbonRed);
      px(ctx, rightStart, ribbonY + Math.floor(droop * 0.4) + 1, rightLen, 1, USF.gold);

      // Snip flash burst right after cut
      if (after < 0.25) {
        drawPixelScissors(ctx, cx - 2, ribbonY - 3, false);
        px(ctx, cx - 4, ribbonY - 4, 9, 1, USF.white);
        px(ctx, cx, ribbonY - 8, 1, 9, USF.white);
        px(ctx, cx - 2, ribbonY - 2, 5, 5, USF.lemongrass);
      }

      // Deterministic festive pixel confetti burst (USF Green, Gold, Lemongrass, Apple, White!)
      const confettiColors = [USF.green, USF.gold, USF.lemongrass, USF.apple, USF.white, USF.sky];
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2 + (i % 3) * 0.2;
        const speed = 14 + (i % 5) * 6;
        const pxX = cx + Math.cos(angle) * speed * after;
        const pxY = (ribbonY - 6) + Math.sin(angle) * speed * 0.7 * after + (after * after * 26) - (16 * after);
        const col = confettiColors[i % confettiColors.length];
        px(ctx, pxX, pxY, i % 3 === 0 ? 3 : 2, 2, col);
      }

      // Floating "DONE!" pixel banner rising over the building
      const floatY = y - 15 - Math.round(after * 10);
      drawPixelPill(ctx, 'COMPLETE!', cx, floatY, USF.green, USF.lemongrass, USF.gold);
    }

    ctx.restore();
  }

  function drawPixelScissors(ctx, x, y, open) {
    // Golden handles
    px(ctx, x - 3, y - 3, 3, 3, USF.gold);
    px(ctx, x - 2, y - 2, 1, 1, USF.ink);
    px(ctx, x - 3, y + 2, 3, 3, USF.gold);
    px(ctx, x - 2, y + 3, 1, 1, USF.ink);
    // Pivot
    px(ctx, x, y, 2, 2, USF.lemongrass);
    // Silver blades
    if (open) {
      px(ctx, x + 2, y - 2, 4, 1, USF.white);
      px(ctx, x + 2, y + 3, 4, 1, USF.silver);
    } else {
      px(ctx, x + 2, y, 5, 2, USF.white);
    }
  }

  // ==========================================================================
  // PIXEL BULL MASCOT (Rocky-style USF Bull with Claude Model Color!)
  // ==========================================================================
  function drawBull(ctx, agent, time) {
    const model = CLAUDE_MODELS[agent.modelId] || CLAUDE_MODELS['claude-opus-4-6'];
    const facingLeft = agent.facing < 0;
    const state = agent.state; // 'idle' | 'walking' | 'working' | 'waiting' | 'conflict' | 'celebrating'

    let bx = Math.round(agent.x);
    let by = Math.round(agent.y);

    // Motion offsets per state
    let hoverOffset = 0;
    let legStep = 0;
    if (state === 'working') {
      // Hovering over the building!
      hoverOffset = -6 + Math.round(Math.sin(time * 5.2 + agent.phase) * 2.5);
    } else if (state === 'walking' || state === 'idle') {
      legStep = Math.floor(time * 8 + agent.phase) % 2;
      hoverOffset = legStep ? -1 : 0;
    } else if (state === 'conflict') {
      // Rapid bumping recoil!
      const bump = Math.round(Math.sin(time * 20 + agent.phase) * 2);
      bx += bump;
      hoverOffset = -Math.abs(bump);
    } else if (state === 'celebrating') {
      hoverOffset = -Math.abs(Math.round(Math.sin(time * 12) * 5));
    }

    // 1. Ground / Roof Shadow (shows levitation cleanly when hovering!)
    if (state === 'working') {
      // Glowing USF gold hover aura ring on roof beneath the hovering Bull!
      const pulseW = 14 + (Math.floor(time * 6) % 2) * 2;
      px(ctx, bx - Math.floor(pulseW / 2), by + 4, pulseW, 4, 'rgba(219, 228, 66, 0.35)');
      px(ctx, bx - 5, by + 5, 10, 2, 'rgba(0, 56, 34, 0.55)');
    } else {
      px(ctx, bx - 5, by + 4, 10, 3, 'rgba(0, 56, 34, 0.40)');
    }

    const sy = by + hoverOffset;

    // 2. Walking dust puffs
    if ((state === 'walking' || state === 'idle') && legStep === 1) {
      const dustX = facingLeft ? bx + 6 : bx - 8;
      px(ctx, dustX, by + 3, 2, 2, 'rgba(237, 235, 209, 0.7)');
    }

    ctx.save();
    ctx.translate(bx, sy);
    if (facingLeft) ctx.scale(-1, 1);

    // --- BODY & MODEL-COLORED JERSEY (origin = center of Bull) ---
    // Outline
    px(ctx, -6, -6, 12, 11, USF.ink);
    // Bull head / fur top
    px(ctx, -5, -5, 10, 5, model.bullFur);
    px(ctx, -4, -5, 8, 2, model.bullFurLight);

    // Curved USF Bull Horns (iconic Rocky silhouette!)
    px(ctx, -8, -8, 3, 2, USF.ink);
    px(ctx, -7, -7, 2, 2, model.horns);
    px(ctx, -6, -6, 2, 1, USF.gold);

    px(ctx, 5, -8, 3, 2, USF.ink);
    px(ctx, 5, -7, 2, 2, model.horns);
    px(ctx, 4, -6, 2, 1, USF.gold);

    // Ears
    px(ctx, -7, -4, 2, 2, model.bullFur);
    px(ctx, 5, -4, 2, 2, model.bullFur);

    // Eyes (expression changes by state!)
    if (state === 'conflict') {
      // Dizzy / angry eyes
      px(ctx, -3, -4, 2, 2, USF.alertRed);
      px(ctx, 1, -4, 2, 2, USF.alertRed);
      px(ctx, -2, -4, 1, 1, USF.white);
      px(ctx, 2, -4, 1, 1, USF.white);
    } else if (state === 'celebrating') {
      // Happy eyes ^ ^
      px(ctx, -3, -3, 2, 1, USF.white);
      px(ctx, 1, -3, 2, 1, USF.white);
    } else {
      // Expressive eyes facing forward-right
      px(ctx, -3, -4, 2, 2, USF.white);
      px(ctx, -2, -3, 1, 1, USF.ink);
      px(ctx, 1, -4, 2, 2, USF.white);
      px(ctx, 2, -3, 1, 1, USF.ink);
    }

    // Snout & nostrils
    px(ctx, -3, -1, 6, 2, '#D7A984');
    px(ctx, -2, -1, 1, 1, USF.ink);
    px(ctx, 1, -1, 1, 1, USF.ink);

    // Claude Model-Colored Jersey / Vest!
    px(ctx, -5, 1, 10, 4, model.primary);
    px(ctx, -5, 3, 10, 1, model.secondary);
    // Tiny USF center stripe on jersey
    px(ctx, -1, 1, 2, 3, USF.white);

    // Arms / Hooves
    if (state === 'working') {
      // Raised animated working arms + little wrench/sparkle!
      const armBob = Math.floor(time * 10) % 2;
      px(ctx, -7, 0 - armBob, 2, 3, model.bullFur);
      px(ctx, 5, -1 + armBob, 2, 3, model.bullFur);
      // Golden pixel wrench / hammer in right hand!
      px(ctx, 6, -4 + armBob, 2, 4, USF.silver);
      px(ctx, 5, -5 + armBob, 4, 2, USF.craneGold);
    } else if (state === 'celebrating') {
      // Arms raised in celebration!
      px(ctx, -7, -2, 2, 3, model.bullFur);
      px(ctx, 5, -2, 2, 3, model.bullFur);
    } else {
      px(ctx, -6, 1, 1, 3, model.bullFur);
      px(ctx, 5, 1, 1, 3, model.bullFur);
    }

    // Legs / Hooves (animated walk stride!)
    const leftLegY  = legStep === 0 ? 5 : 4;
    const rightLegY = legStep === 0 ? 4 : 5;
    px(ctx, -4, leftLegY, 3, 2, USF.ink);
    px(ctx, 1, rightLegY, 3, 2, USF.ink);

    // Little hard-hat when working!
    if (state === 'working') {
      px(ctx, -5, -8, 10, 3, USF.ink);
      px(ctx, -4, -7, 8, 2, USF.craneGold);
      px(ctx, -2, -8, 4, 1, USF.lemongrass);
    }

    ctx.restore();

    // 3. Orbiting state indicators (above the Bull)
    if (state === 'working') {
      // Animated working sparkles & mini pixel progress bar!
      const prog = Math.max(0, Math.min(1, agent.workProgress || 0));
      const barW = 20;
      const barX = bx - 10;
      const barY = sy - 15;
      px(ctx, barX, barY, barW, 5, USF.ink);
      px(ctx, barX + 1, barY + 1, barW - 2, 3, USF.deepForest);
      px(ctx, barX + 1, barY + 1, Math.round((barW - 2) * prog), 3, model.primary);
      // Tiny code sparks
      const sp = Math.floor(time * 6) % 4;
      px(ctx, bx - 10 + sp * 6, sy - 18, 2, 2, USF.lemongrass);
    } else if (state === 'waiting') {
      drawPixelPill(ctx, 'WAIT', bx, sy - 17, USF.slate, USF.gold);
    } else if (state === 'conflict') {
      // Orbiting dizzy pixel stars!
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + (i * Math.PI * 2) / 3;
        const sx = bx + Math.round(Math.cos(a) * 8);
        const starY = sy - 12 + Math.round(Math.sin(a) * 3);
        px(ctx, sx, starY, 2, 2, i % 2 === 0 ? USF.lemongrass : USF.alertRed);
      }
    }

    // 4. Crisp Agent Tag below/above Bull (model color dot + short label)
    const labelY = state === 'working' ? sy - 23 : sy + 8;
    drawPixelPill(ctx, agent.shortLabel, bx, labelY, model.badgeBg, model.badgeText, model.primary);
  }

  // ==========================================================================
  // CONFLICT CRASH FX (3-beat pixel clash animation between colliding Bulls!)
  // ==========================================================================
  function drawConflictCrashFX(ctx, x, y, time, clashProgress = 1) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    const p = Math.max(0, Math.min(1, clashProgress));
    const pulse = Math.floor(time * 12) % 2;

    // 1. Expanding pixel shockwave ring on Beat 1 (0..0.30) and Beat 2 (0.48..0.78)
    const drawShockwave = (localT) => {
      const r = Math.round(4 + localT * 18);
      const col = localT < 0.45 ? USF.white : (localT < 0.75 ? USF.lemongrass : USF.alertRed);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const sx = cx + Math.round(Math.cos(a) * r);
        const sy = cy + Math.round(Math.sin(a) * r * 0.7);
        px(ctx, sx, sy, 2, 2, col);
      }
    };

    if (p < 0.30) {
      drawShockwave(p / 0.30);
    } else if (p >= 0.48 && p < 0.78) {
      drawShockwave((p - 0.48) / 0.30);
    }

    // 2. Scuffle pixel dust cloud billowing around the Bulls during active clash
    if (p < 0.85) {
      for (let d = 0; d < 6; d++) {
        const angle = (d / 6) * Math.PI * 2 + time * 4;
        const dist = 5 + ((d * 3 + Math.floor(time * 10)) % 9);
        const dx = cx + Math.round(Math.cos(angle) * dist);
        const dy = cy + 3 + Math.round(Math.sin(angle) * (dist * 0.45));
        px(ctx, dx - 1, dy - 1, 4, 3, d % 2 === 0 ? USF.sand : USF.gold);
      }
    }

    // 3. Comic pixel starburst rays + flying sparks
    const rayR = p < 0.75 ? (pulse ? 13 : 9) : (pulse ? 9 : 7);
    const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
    dirs.forEach(([dx, dy], idx) => {
      const col = idx % 2 === 0 ? USF.lemongrass : USF.alertRed;
      px(ctx, cx + dx * rayR - 1, cy + dy * rayR - 1, 2, 2, col);
      px(ctx, cx + dx * Math.max(2, rayR - 4) - 1, cy + dy * Math.max(2, rayR - 4) - 1, 2, 2, USF.white);
    });

    // Central flash core on impact beats
    if ((p < 0.24 || (p > 0.48 && p < 0.64)) && pulse === 0) {
      px(ctx, cx - 3, cy - 3, 6, 6, USF.white);
      px(ctx, cx - 2, cy - 2, 4, 4, USF.lemongrass);
    }

    // 4. Dynamic comic pixel callout rising above the clash
    const callout = p < 0.35 ? 'BAM!' : (p < 0.75 ? 'CLASH!' : 'CONFLICT!');
    const bounceY = p < 0.75 ? (pulse ? -23 : -20) : -21;
    drawPixelPill(
      ctx,
      callout,
      cx,
      cy + bounceY,
      pulse ? USF.alertRed : USF.ink,
      pulse ? USF.white : USF.lemongrass,
      USF.gold
    );
  }

  return {
    px,
    drawPixelText,
    drawPixelPill,
    drawPixelTree,
    drawInteractiveBuilding,
    drawConstructionSite,
    drawRibbonCutting,
    drawBull,
    drawConflictCrashFX,
  };
})();
