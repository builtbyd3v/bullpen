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
    '#': ['101','111','101','111','101'],
    '(': ['001','010','010','010','001'],
    ')': ['100','010','010','010','100'],
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
  // INTERACTIVE PIXEL BUILDINGS — High-Detail Zoomed USF Architecture!
  // Labeled with each building's mapped folder name (live-updated from Options)
  // ==========================================================================
  function drawInteractiveBuilding(ctx, b, opts) {
    const { hovered, selected, status, time } = opts;
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    const w = Math.round(b.w);
    const h = Math.round(b.h);
    const folderLabel = window.BullpenCampusData.getFolderLabel(b.folder);

    // 1. Highlight glow / status perimeter
    if (status === 'kickout') {
      const pulse = Math.floor(time * 12) % 2 === 0;
      px(ctx, x - 3, y - 3, w + 6, h + 6, pulse ? USF.alertRed : USF.lemongrass);
    } else if (hovered || selected) {
      px(ctx, x - 3, y - 3, w + 6, h + 6, hovered ? USF.lemongrass : USF.gold);
      px(ctx, x - 1, y - 1, w + 2, h + 2, USF.green);
    } else if (status === 'working') {
      px(ctx, x - 2, y - 2, w + 4, h + 4, USF.craneGold);
    } else if (status === 'ribbon') {
      px(ctx, x - 2, y - 2, w + 4, h + 4, USF.apple);
    }

    // 2. Ground drop shadow (crisp south-east pixel depth)
    px(ctx, x + 3, y + 4, w, h, 'rgba(0, 56, 34, 0.42)');

    // 3. Detailed Architectural Pixel Art by Building Landmark
    if (b.roofStyle === 'dome') {
      // ======================================================================
      // SUN DOME (Yuengling Center) — Ribbed Octagonal Arena Dome + SSP Annex
      // ======================================================================
      const cx = x + Math.floor(w / 2);
      const domeH = h - 10;
      const cy = y + Math.floor(domeH / 2);

      // Outer stepped octagonal concrete apron & perimeter columns
      px(ctx, x + 8, y, w - 16, domeH, USF.ink);
      px(ctx, x + 4, y + 4, w - 8, domeH - 8, USF.ink);
      px(ctx, x, y + 8, w, domeH - 16, USF.ink);

      // Concrete facade base wall
      px(ctx, x + 9, y + 1, w - 18, domeH - 2, USF.bldgDark);
      px(ctx, x + 5, y + 5, w - 10, domeH - 10, USF.bldgMid);
      px(ctx, x + 1, y + 9, w - 2, domeH - 18, USF.bldgMid);

      // Exterior arena buttress pillars along perimeter
      for (let bx = x + 12; bx < x + w - 12; bx += 8) {
        px(ctx, bx, y + 2, 2, 3, USF.sand);
        px(ctx, bx, y + domeH - 5, 2, 3, USF.sand);
      }
      for (let by = y + 12; by < y + domeH - 12; by += 7) {
        px(ctx, x + 2, by, 3, 2, USF.sand);
        px(ctx, x + w - 5, by, 3, 2, USF.sand);
      }

      // USF Green structural tension ring
      px(ctx, x + 10, y + 5, w - 20, domeH - 10, USF.evergreen);
      px(ctx, x + 6, y + 9, w - 12, domeH - 18, USF.green);

      // Stepped white/sand fiberglass stadium dome roof
      px(ctx, x + 12, y + 7, w - 24, domeH - 14, USF.sand);
      px(ctx, x + 8, y + 11, w - 16, domeH - 22, USF.sand);
      px(ctx, x + 15, y + 9, w - 30, domeH - 18, USF.white);
      px(ctx, x + 12, y + 13, w - 24, domeH - 26, USF.white);

      // 8 radial USF Gold & Silver stadium dome ribs
      px(ctx, cx - 1, y + 6, 2, domeH - 12, USF.gold);
      px(ctx, x + 7, cy - 1, w - 14, 2, USF.gold);
      for (let d = 5; d <= 16; d++) {
        px(ctx, cx - d, cy - Math.round(d * 0.7), 1, 1, USF.silver);
        px(ctx, cx + d, cy - Math.round(d * 0.7), 1, 1, USF.silver);
        px(ctx, cx - d, cy + Math.round(d * 0.7), 1, 1, USF.silver);
        px(ctx, cx + d, cy + Math.round(d * 0.7), 1, 1, USF.silver);
      }

      // Central glowing oculus skylight crown
      px(ctx, cx - 7, cy - 5, 14, 10, USF.green);
      px(ctx, cx - 5, cy - 3, 10, 6, USF.storm);
      px(ctx, cx - 4, cy - 2, 8, 3, USF.sky);
      px(ctx, cx - 2, cy - 2, 3, 1, USF.white);

      // West concourse entrance doors facing Genshaft Dr
      px(ctx, x + 1, cy - 5, 3, 10, USF.evergreen);
      px(ctx, x + 2, cy - 3, 2, 6, USF.lemongrass);

      // Circular SSP South Annex with skylight
      px(ctx, cx - 13, y + h - 13, 26, 13, USF.ink);
      px(ctx, cx - 12, y + h - 12, 24, 11, USF.bldgDark);
      px(ctx, cx - 10, y + h - 11, 20, 8, USF.bldgLight);
      px(ctx, cx - 6, y + h - 9, 12, 4, USF.storm);
      px(ctx, cx - 5, y + h - 8, 10, 2, USF.sky);

    } else if (b.roofStyle === 'marshall') {
      // ======================================================================
      // MARSHALL STUDENT CENTER — Grand U-Wing Union, Atrium Skylight & Plaza
      // ======================================================================
      px(ctx, x, y, w, h, USF.ink);
      px(ctx, x + 1, y + 1, w - 2, h - 2, USF.bldgDark);
      // Warm sandstone main facade
      px(ctx, x + 1, y + 1, w - 2, h - 9, USF.bldgMid);

      // Raised U-shaped tiled roof wings with crisp cornice bevels
      px(ctx, x + 2, y + 2, w - 4, 12, USF.bldgLight);
      px(ctx, x + 3, y + 3, w - 6, 3, USF.sand); // sun-lit north parapet
      px(ctx, x + 2, y + 2, 16, h - 11, USF.bldgLight);
      px(ctx, x + w - 18, y + 2, 16, h - 11, USF.bldgLight);
      // Roof mechanical boxes on side wings
      px(ctx, x + 5, y + 7, 7, 5, USF.silver);
      px(ctx, x + 6, y + 8, 5, 3, USF.gray);
      px(ctx, x + w - 13, y + 7, 7, 5, USF.silver);
      px(ctx, x + w - 12, y + 8, 5, 3, USF.gray);

      // Stepped Blue-Sky Glass Central Atrium Skylight!
      const ax = x + 19, ay = y + 12, aw = w - 38, ah = 15;
      px(ctx, ax, ay, aw, ah, USF.ink);
      px(ctx, ax + 1, ay + 1, aw - 2, ah - 2, USF.storm);
      px(ctx, ax + 2, ay + 2, aw - 4, 5, USF.sky);
      px(ctx, ax + 3, ay + 3, aw - 12, 2, USF.white); // glass specular shine
      // Skylight steel mullions
      for (let mx = ax + 6; mx < ax + aw - 3; mx += 6) {
        px(ctx, mx, ay + 1, 1, ah - 2, USF.evergreen);
      }

      // Lower colonnade facade + 2 floors of glowing student union windows
      px(ctx, x + 2, y + h - 11, w - 4, 9, USF.sand);
      for (let wx = x + 4; wx < x + w - 5; wx += 5) {
        px(ctx, wx, y + h - 10, 3, 3, USF.storm);
        px(ctx, wx, y + h - 10, 2, 1, USF.sky);
        px(ctx, wx, y + h - 5, 3, 3, USF.slate);
      }
      // Iconic USF Green & Gold Front Entrance Awning + double glass doors
      const ex = x + Math.floor(w / 2) - 10;
      px(ctx, ex, y + h - 9, 20, 4, USF.green);
      px(ctx, ex, y + h - 6, 20, 1, USF.gold);
      px(ctx, ex + 4, y + h - 5, 12, 4, USF.evergreen);
      px(ctx, ex + 5, y + h - 4, 4, 3, USF.lemongrass);
      px(ctx, ex + 11, y + h - 4, 4, 3, USF.lemongrass);

    } else if (b.roofStyle === 'engineering') {
      // ======================================================================
      // ENGINEERING BUILDING II — Solar Array, Animated HVAC Fans & Skybridge
      // ======================================================================
      px(ctx, x, y, w, h, USF.ink);
      px(ctx, x + 1, y + 1, w - 2, h - 2, USF.bldgDark);
      px(ctx, x + 1, y + 1, w - 2, h - 11, USF.bldgMid);
      px(ctx, x + 2, y + 2, w - 4, h - 15, USF.bldgLight);
      px(ctx, x + 3, y + 3, w - 6, 2, USF.sand);

      // Twin Rooftop Industrial HVAC Fan Units (with animated spinning blades!)
      const fanSpin = Math.floor(time * 8) % 2;
      [x + 6, x + 18].forEach(fx => {
        px(ctx, fx, y + 6, 9, 9, USF.slate);
        px(ctx, fx + 1, y + 7, 7, 7, USF.silver);
        px(ctx, fx + 2, y + 8, 5, 5, USF.ink);
        if (fanSpin === 0) {
          px(ctx, fx + 4, y + 8, 1, 5, USF.gray);
          px(ctx, fx + 2, y + 10, 5, 1, USF.gray);
        } else {
          px(ctx, fx + 3, y + 9, 3, 3, USF.gray);
          px(ctx, fx + 4, y + 10, 1, 1, USF.white);
        }
      });

      // Rooftop Solar Panel Array (angled dark-blue grid with sun glare!)
      const sx = x + 31, sy = y + 6, sw = 24, sh = 11;
      px(ctx, sx, sy, sw, sh, USF.ink);
      px(ctx, sx + 1, sy + 1, sw - 2, sh - 2, USF.storm);
      for (let gx = sx + 5; gx < sx + sw - 2; gx += 5) {
        px(ctx, gx, sy + 1, 1, sh - 2, USF.silver);
      }
      px(ctx, sx + 1, sy + 5, sw - 2, 1, USF.silver);
      px(ctx, sx + 2, sy + 2, 3, 2, USF.sky);
      px(ctx, sx + 12, sy + 2, 3, 2, USF.sky);

      // East Glass Skybridge Wing
      px(ctx, x + w - 13, y + 7, 12, 16, USF.evergreen);
      px(ctx, x + w - 12, y + 8, 10, 14, USF.teal);
      px(ctx, x + w - 11, y + 9, 8, 3, USF.sky);
      px(ctx, x + w - 11, y + 14, 8, 3, USF.sky);

      // Two-Story Curtain-Wall Tech Facade with Lit Workstations!
      px(ctx, x + 2, y + h - 13, w - 4, 11, USF.bldgDark);
      for (let wx = x + 4; wx < x + w - 5; wx += 6) {
        // Upper lab floor
        px(ctx, wx, y + h - 12, 4, 4, USF.evergreen);
        px(ctx, wx + 1, y + h - 11, 2, 2, (wx % 12 === 0) ? USF.lemongrass : USF.sky);
        // Ground floor
        px(ctx, wx, y + h - 6, 4, 4, USF.slate);
        px(ctx, wx + 1, y + h - 5, 2, 2, USF.seaglass);
      }
      // Main USF Green Engineering Canopy Entrance
      const ex = x + Math.floor(w / 2) - 9;
      px(ctx, ex, y + h - 8, 18, 3, USF.green);
      px(ctx, ex, y + h - 6, 18, 1, USF.gold);
      px(ctx, ex + 4, y + h - 5, 10, 4, USF.ink);
      px(ctx, ex + 5, y + h - 4, 3, 3, USF.sky);
      px(ctx, ex + 10, y + h - 4, 3, 3, USF.sky);

    } else if (b.roofStyle === 'library') {
      // ======================================================================
      // USF TAMPA LIBRARY — Tall Brutalist Tower, Concrete Fins & 3 Study Floors
      // ======================================================================
      px(ctx, x, y - 4, w, h + 4, USF.ink);
      px(ctx, x + 1, y - 3, w - 2, h + 2, USF.bldgDark);
      px(ctx, x + 1, y - 3, w - 2, h - 4, USF.sand);

      // Stepped Mechanical Penthouse + Glowing Roof Skylight Strip
      px(ctx, x + 6, y - 1, w - 12, 9, USF.bldgMid);
      px(ctx, x + 7, y, w - 14, 7, USF.bldgLight);
      px(ctx, x + 10, y + 2, w - 20, 4, USF.storm);
      px(ctx, x + 11, y + 3, w - 22, 2, USF.sky);

      // Iconic Vertical Concrete Brise-Soleil Fins + 3 Full Study Window Floors!
      for (let fx = x + 3; fx < x + w - 4; fx += 5) {
        px(ctx, fx, y + 10, 2, h - 13, USF.bldgLight);
        px(ctx, fx + 1, y + 10, 1, h - 13, USF.white);
        // Floor 3 (top study floor)
        px(ctx, fx + 2, y + 11, 3, 4, USF.evergreen);
        px(ctx, fx + 3, y + 12, 2, 2, (fx % 10 === 0) ? USF.lemongrass : USF.sky);
        // Floor 2 (middle stacks)
        px(ctx, fx + 2, y + 17, 3, 4, USF.slate);
        px(ctx, fx + 3, y + 18, 2, 2, USF.lemongrass);
        // Floor 1 (reading lounge)
        px(ctx, fx + 2, y + 23, 3, 4, USF.storm);
        px(ctx, fx + 3, y + 24, 2, 2, USF.sky);
      }

      // Grand USF Green Library Entrance Steps & Glass Portico
      const ex = x + Math.floor(w / 2) - 9;
      px(ctx, ex - 2, y + h - 8, 22, 3, USF.green);
      px(ctx, ex - 2, y + h - 6, 22, 1, USF.gold);
      px(ctx, ex + 2, y + h - 5, 14, 4, USF.evergreen);
      px(ctx, ex + 4, y + h - 4, 4, 3, USF.lemongrass);
      px(ctx, ex + 10, y + h - 4, 4, 3, USF.lemongrass);

    } else if (b.roofStyle === 'courtyard') {
      // ======================================================================
      // MUMA COLLEGE OF BUSINESS — 4-Wing Quad + Inner Garden Courtyard & Fountain
      // ======================================================================
      px(ctx, x, y, w, h, USF.ink);
      px(ctx, x + 1, y + 1, w - 2, h - 2, USF.bldgDark);
      px(ctx, x + 1, y + 1, w - 2, h - 7, USF.bldgMid);
      px(ctx, x + 2, y + 2, w - 4, h - 10, USF.bldgLight);
      px(ctx, x + 3, y + 3, w - 6, 2, USF.sand);

      // Detailed Inner Academic Courtyard Garden!
      const qx = x + 11, qy = y + 10, qw = w - 22, qh = h - 24;
      px(ctx, qx, qy, qw, qh, USF.ink);
      px(ctx, qx + 1, qy + 1, qw - 2, qh - 2, USF.evergreen);
      px(ctx, qx + 2, qy + 2, qw - 4, qh - 4, USF.apple);
      // Stone cross walkways
      px(ctx, qx + Math.floor(qw / 2) - 1, qy + 1, 3, qh - 2, USF.sand);
      px(ctx, qx + 1, qy + Math.floor(qh / 2) - 1, qw - 2, 3, USF.sand);
      // Sparkling central pixel fountain!
      const fcx = qx + Math.floor(qw / 2);
      const fcy = qy + Math.floor(qh / 2);
      px(ctx, fcx - 4, fcy - 4, 9, 9, USF.silver);
      px(ctx, fcx - 3, fcy - 3, 7, 7, USF.sky);
      px(ctx, fcx - 1, fcy - 1, 3, 3, (Math.floor(time * 5) % 2 === 0) ? USF.white : USF.seaglass);

      // Symmetrical south-wing facade windows + entrance
      px(ctx, x + 2, y + h - 8, w - 4, 6, USF.bldgDark);
      for (let wx = x + 4; wx < x + w - 5; wx += 5) {
        px(ctx, wx, y + h - 7, 3, 3, USF.storm);
        px(ctx, wx, y + h - 7, 2, 1, USF.sky);
      }
      px(ctx, x + Math.floor(w / 2) - 6, y + h - 7, 12, 5, USF.green);
      px(ctx, x + Math.floor(w / 2) - 4, y + h - 6, 8, 4, USF.gold);

    } else if (b.roofStyle === 'science') {
      // ======================================================================
      // INTERDISCIPLINARY SCIENCES (ISA) — Curved Glass Lab Wing & Fume Stacks
      // ======================================================================
      px(ctx, x, y, w, h, USF.ink);
      px(ctx, x + 1, y + 1, w - 2, h - 2, USF.bldgDark);
      px(ctx, x + 1, y + 1, w - 2, h - 10, USF.bldgMid);
      px(ctx, x + 2, y + 2, w - 4, h - 13, USF.bldgLight);

      // Rooftop science lab fume exhaust stacks
      for (let sx = x + 6; sx < x + 26; sx += 6) {
        px(ctx, sx, y + 5, 4, 5, USF.slate);
        px(ctx, sx + 1, y + 6, 2, 3, USF.silver);
      }
      // Curved modern blue-glass lab wing on east side
      px(ctx, x + w - 18, y + 4, 15, h - 15, USF.storm);
      px(ctx, x + w - 16, y + 6, 11, 5, USF.sky);
      px(ctx, x + w - 15, y + 7, 5, 2, USF.white);
      px(ctx, x + w - 16, y + 13, 11, 5, USF.seaglass);

      // Multi-floor banded laboratory windows
      for (let wx = x + 4; wx < x + w - 6; wx += 5) {
        px(ctx, wx, y + h - 9, 3, 3, USF.storm);
        px(ctx, wx, y + h - 9, 2, 1, USF.sky);
        px(ctx, wx, y + h - 5, 3, 3, USF.evergreen);
      }
      px(ctx, x + Math.floor(w / 2) - 6, y + h - 6, 12, 4, USF.green);

    } else if (b.roofStyle === 'rec') {
      // ======================================================================
      // CAMPUS RECREATION CENTER (REC) — Ribbed Gym Roof & Clerestory Skylight
      // ======================================================================
      px(ctx, x, y, w, h, USF.ink);
      px(ctx, x + 1, y + 1, w - 2, h - 2, USF.bldgDark);
      px(ctx, x + 1, y + 1, w - 2, h - 9, USF.bldgMid);
      px(ctx, x + 2, y + 2, w - 4, h - 12, USF.bldgLight);

      // Standing-seam ribbed gym roof texture
      for (let rx = x + 5; rx < x + w - 4; rx += 5) {
        px(ctx, rx, y + 3, 1, h - 15, USF.bldgDark);
        px(ctx, rx + 1, y + 3, 1, h - 15, USF.sand);
      }
      // Long central clerestory skylight bar
      px(ctx, x + 8, y + 10, w - 16, 7, USF.ink);
      px(ctx, x + 9, y + 11, w - 18, 5, USF.storm);
      px(ctx, x + 10, y + 12, w - 20, 2, USF.sky);

      // Tall gym glass curtain wall + USF Green entrance portico
      for (let wx = x + 4; wx < x + w - 5; wx += 6) {
        px(ctx, wx, y + h - 8, 4, 5, USF.storm);
        px(ctx, wx + 1, y + h - 7, 2, 2, USF.sky);
      }
      px(ctx, x + 4, y + h - 9, 14, 3, USF.green);
      px(ctx, x + 4, y + h - 7, 14, 1, USF.gold);

    } else if (b.roofStyle === 'arts') {
      // ======================================================================
      // FINE ARTS HALL (FAH) — Sawtooth North-Light Studio Skylights & Gallery
      // ======================================================================
      px(ctx, x, y, w, h, USF.ink);
      px(ctx, x + 1, y + 1, w - 2, h - 2, USF.bldgDark);
      px(ctx, x + 1, y + 1, w - 2, h - 9, USF.bldgMid);
      px(ctx, x + 2, y + 2, w - 4, h - 12, USF.bldgLight);

      for (let sy = y + 5; sy <= y + 19; sy += 7) {
        px(ctx, x + 5, sy, w - 10, 5, USF.bldgDark);
        px(ctx, x + 6, sy, w - 12, 2, USF.sky);
        px(ctx, x + 7, sy, 8, 1, USF.white);
        px(ctx, x + 6, sy + 2, w - 12, 2, USF.sand);
      }
      for (let wx = x + 4; wx < x + w - 5; wx += 6) {
        px(ctx, wx, y + h - 8, 4, 5, USF.slate);
        px(ctx, wx + 1, y + h - 7, 2, 2, USF.lemongrass);
      }
      px(ctx, x + Math.floor(w / 2) - 6, y + h - 7, 12, 5, USF.green);
      px(ctx, x + Math.floor(w / 2) - 5, y + h - 7, 10, 1, USF.gold);

    } else if (b.roofStyle === 'cooper') {
      // COOPER HALL — Long Academic Hall with Twin Skylights & Brick Trim
      px(ctx, x, y, w, h, USF.ink);
      px(ctx, x + 1, y + 1, w - 2, h - 2, USF.bldgDark);
      px(ctx, x + 1, y + 1, w - 2, h - 8, USF.bldgMid);
      px(ctx, x + 2, y + 2, w - 4, h - 11, USF.bldgLight);
      px(ctx, x + 6, y + 5, 14, 5, USF.storm);
      px(ctx, x + 7, y + 6, 12, 2, USF.sky);
      px(ctx, x + w - 20, y + 5, 14, 5, USF.storm);
      px(ctx, x + w - 19, y + 6, 12, 2, USF.sky);
      for (let wx = x + 4; wx < x + w - 5; wx += 5) {
        px(ctx, wx, y + h - 6, 3, 3, USF.evergreen);
      }
      px(ctx, x + Math.floor(w / 2) - 5, y + h - 6, 10, 4, USF.green);

    } else if (b.roofStyle === 'services') {
      // STUDENT SERVICES (SVC) — Stepped Glass Corner Atrium
      px(ctx, x, y, w, h, USF.ink);
      px(ctx, x + 1, y + 1, w - 2, h - 2, USF.bldgDark);
      px(ctx, x + 1, y + 1, w - 2, h - 8, USF.bldgMid);
      px(ctx, x + 2, y + 2, w - 4, h - 11, USF.sand);
      px(ctx, x + 5, y + 5, w - 10, 9, USF.teal);
      px(ctx, x + 6, y + 6, w - 12, 4, USF.sky);
      px(ctx, x + 7, y + 7, 8, 2, USF.white);
      for (let wx = x + 4; wx < x + w - 5; wx += 5) {
        px(ctx, wx, y + h - 6, 3, 3, USF.slate);
      }

    } else if (b.roofStyle === 'education') {
      // COLLEGE OF EDUCATION — Courtyard Terrace & Stepped Roof
      px(ctx, x, y, w, h, USF.ink);
      px(ctx, x + 1, y + 1, w - 2, h - 2, USF.bldgDark);
      px(ctx, x + 1, y + 1, w - 2, h - 8, USF.bldgMid);
      px(ctx, x + 2, y + 2, w - 4, h - 11, USF.bldgLight);
      px(ctx, x + 6, y + 5, w - 12, 8, USF.evergreen);
      px(ctx, x + 7, y + 6, w - 14, 6, USF.apple);
      for (let wx = x + 4; wx < x + w - 5; wx += 5) {
        px(ctx, wx, y + h - 7, 3, 4, USF.storm);
        px(ctx, wx, y + h - 7, 2, 1, USF.sky);
      }

    } else if (b.roofStyle === 'residence') {
      // JUNIPER-POPLAR HALL — Twin Wing Modern Complex with Balconies
      px(ctx, x, y, w, h, USF.ink);
      px(ctx, x + 1, y + 1, w - 2, h - 2, USF.bldgDark);
      px(ctx, x + 1, y + 1, w - 2, h - 9, USF.bldgMid);
      px(ctx, x + 2, y + 2, w - 4, 12, USF.bldgLight);
      px(ctx, x + 4, y + 5, w - 8, 5, USF.silver);
      for (let ry = y + 16; ry < y + h - 6; ry += 6) {
        for (let wx = x + 4; wx < x + w - 5; wx += 5) {
          px(ctx, wx, ry, 3, 3, USF.storm);
          px(ctx, wx + 1, ry, 2, 1, USF.lemongrass);
        }
      }
      px(ctx, x + Math.floor(w / 2) - 5, y + h - 6, 10, 4, USF.green);

    } else if (b.roofStyle === 'tower') {
      // UNIVERSITY TOWER SOUTH — Multi-Floor Terraced Complex with Solar Roof
      px(ctx, x, y, w, h, USF.ink);
      px(ctx, x + 1, y + 1, w - 2, h - 2, USF.bldgDark);
      px(ctx, x + 1, y + 1, w - 2, h - 11, USF.bldgMid);
      px(ctx, x + 2, y + 2, w - 4, h - 14, USF.sand);
      px(ctx, x + 6, y + 5, w - 12, 10, USF.storm);
      px(ctx, x + 7, y + 6, w - 14, 4, USF.sky);
      for (let wx = x + 4; wx < x + w - 5; wx += 6) {
        px(ctx, wx, y + h - 10, 4, 3, USF.evergreen);
        px(ctx, wx, y + h - 5, 4, 3, USF.slate);
      }
      px(ctx, x + Math.floor(w / 2) - 6, y + h - 7, 12, 5, USF.green);

    } else {
      // USF ALUMNI CENTER — Pitched Green-Trimmed Pavilion & Columned Portico
      px(ctx, x, y, w, h, USF.ink);
      px(ctx, x + 1, y + 1, w - 2, h - 2, USF.bldgDark);
      px(ctx, x + 1, y + 1, w - 2, h - 10, USF.bldgMid);
      px(ctx, x + 3, y + 3, w - 6, h - 14, USF.green);
      px(ctx, x + 6, y + 6, w - 12, h - 20, USF.evergreen);
      px(ctx, x + Math.floor(w / 2) - 5, y + 8, 10, 8, USF.gold);
      px(ctx, x + Math.floor(w / 2) - 3, y + 10, 6, 4, USF.lemongrass);
      for (let wx = x + 4; wx < x + w - 5; wx += 6) {
        px(ctx, wx, y + h - 8, 4, 5, USF.sand);
        px(ctx, wx + 1, y + h - 7, 2, 3, USF.slate);
      }
    }

    // 4. Guarded Zone USF Shield Emblem (e.g. /database)
    if (b.guarded) {
      const sx = x + w - 10;
      const sy = y - 2;
      px(ctx, sx, sy, 10, 11, USF.ink);
      px(ctx, sx + 1, sy + 1, 8, 7, USF.green);
      px(ctx, sx + 2, sy + 8, 6, 1, USF.green);
      px(ctx, sx + 3, sy + 9, 4, 1, USF.green);
      px(ctx, sx + 4, sy + 2, 2, 5, USF.lemongrass);
      px(ctx, sx + 2, sy + 4, 6, 1, USF.lemongrass);
    }

    // 5. Folder Name Plaque (replaces building code abbreviation!)
    const pillBg = status === 'kickout'
      ? USF.alertRed
      : (status === 'working' ? USF.evergreen : (b.primary ? USF.green : USF.slate));
    const pillFg = status === 'kickout' ? USF.white : (b.primary ? USF.lemongrass : USF.sand);
    drawPixelPill(ctx, folderLabel, x + w / 2, y + h - 3, pillBg, pillFg, USF.ink);
  }

  // ==========================================================================
  // CONSTRUCTION SITE FX (Cones, Multi-Tier Scaffolding, Tall Animated Crane!)
  // ==========================================================================
  function drawConstructionSite(ctx, b, time) {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    const w = Math.round(b.w);
    const h = Math.round(b.h);

    // 1. Yellow/black hazard tape flanking left & right of the folder name plaque
    const folderLabel = window.BullpenCampusData.getFolderLabel(b.folder);
    const pillHalfW = Math.ceil((folderLabel.length * 4 + 7) / 2);
    const cx = Math.round(x + w / 2);
    for (let tx = x - 4; tx < x + w + 3; tx += 4) {
      if (tx + 3 > cx - pillHalfW && tx < cx + pillHalfW) continue;
      px(ctx, tx, y + h + 1, 2, 2, USF.craneGold);
      px(ctx, tx + 2, y + h + 1, 2, 2, USF.ink);
    }

    // 2. Multi-Tier Pixel Scaffolding wrapping the enlarged building facade
    const scafColor = USF.silver;
    const scafDark  = USF.slate;
    for (let sx = x - 1; sx <= x + w; sx += 12) {
      px(ctx, sx, y - 4, 1, h + 4, scafDark);
      px(ctx, sx + 1, y - 4, 1, h + 4, scafColor);
    }
    const levels = [y + 2, y + Math.floor(h * 0.36), y + Math.floor(h * 0.68), y + h - 4];
    levels.forEach(ly => {
      px(ctx, x - 2, ly, w + 4, 2, USF.bldgDark);
      px(ctx, x - 2, ly, w + 4, 1, USF.gold);
    });
    // Diagonal cross X-bracing pixels on left & right bays
    for (let i = 0; i < 9; i++) {
      px(ctx, x + 2 + i, y + 4 + i, 1, 1, scafColor);
      px(ctx, x + 10 - i, y + 4 + i, 1, 1, scafColor);
      px(ctx, x + w - 11 + i, y + 4 + i, 1, 1, scafColor);
      px(ctx, x + w - 3 - i, y + 4 + i, 1, 1, scafColor);
    }

    // 3. Orange Traffic Cones with white reflective bands around perimeter
    const cones = [
      [x - 7, y + h - 1],
      [x + w + 3, y + h - 1],
      [x - 7, y + 4],
      [x + w + 3, y + 4],
      [x + Math.floor(w * 0.3), y + h + 4],
      [x + Math.floor(w * 0.7), y + h + 4],
    ];
    cones.forEach(([cx, cy]) => {
      px(ctx, cx - 1, cy + 4, 5, 1, USF.ink);
      px(ctx, cx,     cy + 2, 3, 2, USF.coneOrange);
      px(ctx, cx,     cy + 1, 3, 1, USF.white);
      px(ctx, cx + 1, cy,     1, 1, USF.coneOrange);
    });

    // 4. Tall Animated Pixel Tower Crane beside the building!
    const craneX = x + w + 5;
    const craneBaseY = y + h;
    const towerH = Math.max(42, h + 14);
    const topY = craneBaseY - towerH;

    // Concrete crane base
    px(ctx, craneX - 3, craneBaseY - 3, 10, 5, USF.slate);
    px(ctx, craneX - 2, craneBaseY - 2, 8, 3, USF.silver);

    // Lattice mast tower
    px(ctx, craneX, topY, 1, towerH - 3, USF.ink);
    px(ctx, craneX + 4, topY, 1, towerH - 3, USF.ink);
    px(ctx, craneX + 1, topY, 3, towerH - 3, USF.craneGold);
    for (let ty = topY + 2; ty < craneBaseY - 4; ty += 4) {
      px(ctx, craneX + 1, ty, 3, 1, USF.ink);
    }

    // Operator cab
    px(ctx, craneX - 3, topY + 5, 8, 5, USF.ink);
    px(ctx, craneX - 2, topY + 6, 6, 3, USF.sky);

    // Horizontal jib arm extending LEFT over the building + counterweight RIGHT
    const jibLeft = x + 4;
    const jibRight = craneX + 14;
    px(ctx, jibLeft, topY - 1, jibRight - jibLeft, 3, USF.ink);
    px(ctx, jibLeft + 1, topY, jibRight - jibLeft - 2, 1, USF.craneGold);
    px(ctx, jibRight - 5, topY - 1, 6, 5, USF.slate);
    px(ctx, jibRight - 4, topY, 4, 3, USF.silver);
    // Apex mast & tension cables
    px(ctx, craneX + 1, topY - 7, 3, 7, USF.craneGold);
    px(ctx, craneX - 8, topY - 4, 9, 1, USF.ink);
    px(ctx, craneX + 4, topY - 4, 7, 1, USF.ink);

    // Animated trolley sliding back & forth along jib + hanging gold I-beam!
    const swing = (Math.sin(time * 2.2) + 1) * 0.5;
    const trolleyX = Math.round(jibLeft + 6 + swing * Math.max(10, (craneX - jibLeft - 14)));
    const cableLen = Math.round(9 + Math.sin(time * 3.1) * 4);
    px(ctx, trolleyX - 2, topY + 2, 5, 2, USF.ink);
    px(ctx, trolleyX, topY + 4, 1, cableLen, USF.ink);
    const hookY = topY + 4 + cableLen;
    px(ctx, trolleyX - 1, hookY, 3, 2, USF.coneOrange);
    px(ctx, trolleyX - 6, hookY + 2, 13, 3, USF.ink);
    px(ctx, trolleyX - 5, hookY + 3, 11, 1, USF.gold);

    // 5. Twinkling pixel welding sparks
    const sparkPhase = Math.floor(time * 10);
    for (let s = 0; s < 4; s++) {
      if ((sparkPhase + s) % 3 === 0) {
        const sx = x + ((s * 17 + sparkPhase * 5) % Math.max(12, w - 6));
        const sy = y + ((s * 11 + sparkPhase * 3) % Math.max(10, h - 6));
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
  function drawBull(ctx, agent, time, timeLimitSec = 15) {
    const model = CLAUDE_MODELS[agent.modelId] || CLAUDE_MODELS['claude-opus-4-6'];
    const facingLeft = agent.facing < 0;
    const state = agent.state; // 'idle' | 'walking' | 'waiting' | 'working' | 'kicked' | 'celebrating'

    let bx = Math.round(agent.x);
    let by = Math.round(agent.y);

    // Motion offsets per state
    let hoverOffset = 0;
    let legStep = 0;
    let tapFoot = false;
    if (state === 'working') {
      // Hovering over the building!
      hoverOffset = -6 + Math.round(Math.sin(time * 5.2 + agent.phase) * 2.5);
    } else if (state === 'walking' || state === 'idle') {
      legStep = Math.floor(time * 8 + agent.phase) % 2;
      hoverOffset = legStep ? -1 : 0;
    } else if (state === 'waiting') {
      // Impatiently tapping foot while waiting outside the building!
      tapFoot = Math.floor(time * 5 + agent.phase) % 2 === 1;
      hoverOffset = Math.floor(time * 2.5 + agent.phase) % 4 === 0 ? -1 : 0;
    } else if (state === 'celebrating') {
      hoverOffset = -Math.abs(Math.round(Math.sin(time * 12) * 5));
    }

    // 1. Ground / Roof Shadow (shrinks dynamically while airborne!)
    if (state === 'working') {
      const pulseW = 14 + (Math.floor(time * 6) % 2) * 2;
      px(ctx, bx - Math.floor(pulseW / 2), by + 4, pulseW, 4, 'rgba(219, 228, 66, 0.35)');
      px(ctx, bx - 5, by + 5, 10, 2, 'rgba(0, 56, 34, 0.55)');
    } else if (state === 'kicked' && Math.abs(agent.spinAngle || 0) > 0.05) {
      // Small shadow beneath airborne kicked Bull
      px(ctx, bx - 3, by + 10, 6, 2, 'rgba(0, 56, 34, 0.25)');
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
    if (state === 'kicked' && agent.spinAngle) {
      ctx.rotate(agent.spinAngle);
    } else if (facingLeft) {
      ctx.scale(-1, 1);
    }

    // --- BODY & MODEL-COLORED JERSEY (origin = center of Bull) ---
    px(ctx, -6, -6, 12, 11, USF.ink);
    px(ctx, -5, -5, 10, 5, model.bullFur);
    px(ctx, -4, -5, 8, 2, model.bullFurLight);

    // Curved USF Bull Horns
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
    if (state === 'kicked') {
      // Shocked / Dizzy X_X eyes!
      px(ctx, -3, -4, 2, 2, USF.alertRed);
      px(ctx, 1, -4, 2, 2, USF.alertRed);
      px(ctx, -3, -4, 1, 1, USF.white);
      px(ctx, 2, -4, 1, 1, USF.white);
    } else if (state === 'celebrating') {
      px(ctx, -3, -3, 2, 1, USF.white);
      px(ctx, 1, -3, 2, 1, USF.white);
    } else if (state === 'waiting') {
      // Looking up expectantly at the building!
      px(ctx, -3, -4, 2, 2, USF.white);
      px(ctx, -2, -4, 1, 1, USF.ink);
      px(ctx, 1, -4, 2, 2, USF.white);
      px(ctx, 2, -4, 1, 1, USF.ink);
    } else {
      px(ctx, -3, -4, 2, 2, USF.white);
      px(ctx, -2, -3, 1, 1, USF.ink);
      px(ctx, 1, -4, 2, 2, USF.white);
      px(ctx, 2, -3, 1, 1, USF.ink);
    }

    // Snout & nostrils
    px(ctx, -3, -1, 6, 2, '#D7A984');
    px(ctx, -2, -1, 1, 1, USF.ink);
    px(ctx, 1, -1, 1, 1, USF.ink);

    // Claude Model-Colored Jersey / Vest
    px(ctx, -5, 1, 10, 4, model.primary);
    px(ctx, -5, 3, 10, 1, model.secondary);
    px(ctx, -1, 1, 2, 3, USF.white);

    // Arms / Hooves
    if (state === 'working') {
      const armBob = Math.floor(time * 10) % 2;
      px(ctx, -7, 0 - armBob, 2, 3, model.bullFur);
      px(ctx, 5, -1 + armBob, 2, 3, model.bullFur);
      // Golden pixel wrench in right hand
      px(ctx, 6, -4 + armBob, 2, 4, USF.silver);
      px(ctx, 5, -5 + armBob, 4, 2, USF.craneGold);
    } else if (state === 'kicked') {
      // Flailing arms while flying!
      px(ctx, -8, -3, 3, 2, model.bullFur);
      px(ctx, 5, -3, 3, 2, model.bullFur);
    } else if (state === 'celebrating') {
      px(ctx, -7, -2, 2, 3, model.bullFur);
      px(ctx, 5, -2, 2, 3, model.bullFur);
    } else if (state === 'waiting') {
      // Arms crossed / checking watch
      px(ctx, -6, 2, 2, 2, model.bullFur);
      px(ctx, 4, 2, 2, 2, model.bullFur);
    } else {
      px(ctx, -6, 1, 1, 3, model.bullFur);
      px(ctx, 5, 1, 1, 3, model.bullFur);
    }

    // Legs / Hooves
    const leftLegY  = state === 'waiting' ? 5 : (legStep === 0 ? 5 : 4);
    const rightLegY = state === 'waiting' ? (tapFoot ? 4 : 5) : (legStep === 0 ? 4 : 5);
    px(ctx, -4, leftLegY, 3, 2, USF.ink);
    px(ctx, 1, rightLegY, 3, 2, USF.ink);

    // Little hard-hat when working!
    if (state === 'working') {
      px(ctx, -5, -8, 10, 3, USF.ink);
      px(ctx, -4, -7, 8, 2, USF.craneGold);
      px(ctx, -2, -8, 4, 1, USF.lemongrass);
    }

    ctx.restore();

    // 3. State indicators above/beside the Bull
    if (state === 'working') {
      const prog = Math.max(0, Math.min(1, agent.workProgress || 0));
      const remaining = Math.max(0, timeLimitSec - (agent.workElapsed || 0));
      const nearTimeout = remaining <= 3.5;
      const barW = 22;
      const barX = bx - 11;
      const barY = sy - 15;
      const borderCol = (nearTimeout && Math.floor(time * 8) % 2 === 0) ? USF.alertRed : USF.ink;
      px(ctx, barX, barY, barW, 5, borderCol);
      px(ctx, barX + 1, barY + 1, barW - 2, 3, USF.deepForest);
      px(ctx, barX + 1, barY + 1, Math.round((barW - 2) * prog), 3, nearTimeout ? USF.coneOrange : model.primary);
      // Tiny code sparks
      const sp = Math.floor(time * 6) % 4;
      px(ctx, bx - 10 + sp * 6, sy - 18, 2, 2, USF.lemongrass);
    } else if (state === 'waiting') {
      // Animated pixel hourglass right next to the waiting Bull!
      drawPixelHourglass(ctx, bx + 9, sy - 6, time);
      const qLabel = `WAIT #${agent.queuePos || 1}`;
      drawPixelPill(ctx, qLabel, bx, sy - 18, USF.evergreen, USF.lemongrass, USF.gold);
    } else if (state === 'kicked') {
      // Orbiting dizzy pixel stars!
      for (let i = 0; i < 3; i++) {
        const a = time * 8 + (i * Math.PI * 2) / 3;
        const sx = bx + Math.round(Math.cos(a) * 9);
        const starY = sy - 11 + Math.round(Math.sin(a) * 3);
        px(ctx, sx, starY, 2, 2, i % 2 === 0 ? USF.lemongrass : USF.alertRed);
      }
    }

    // 4. Crisp Agent Tag below/above Bull
    const labelY = state === 'working' ? sy - 23 : sy + 8;
    drawPixelPill(ctx, agent.shortLabel, bx, labelY, model.badgeBg, model.badgeText, model.primary);
  }

  // Animated 5x7 Pixel Hourglass beside Waiting Bulls
  function drawPixelHourglass(ctx, x, y, time) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    const phase = Math.floor(time * 4) % 4;
    // Gold caps
    px(ctx, ix, iy, 5, 1, USF.gold);
    px(ctx, ix, iy + 6, 5, 1, USF.gold);
    // Glass body
    px(ctx, ix + 1, iy + 1, 3, 2, USF.sky);
    px(ctx, ix + 2, iy + 3, 1, 1, USF.white);
    px(ctx, ix + 1, iy + 4, 3, 2, USF.sky);
    // Animated falling USF gold sand!
    if (phase < 3) px(ctx, ix + 1, iy + 1, 3, phase === 0 ? 2 : 1, USF.lemongrass);
    if (phase >= 1) px(ctx, ix + 2, iy + 3, 1, 2, USF.lemongrass);
    if (phase >= 2) px(ctx, ix + 1, iy + 5, 3, 1, USF.lemongrass);
    if (phase === 3) px(ctx, ix + 1, iy + 4, 3, 2, USF.lemongrass);
  }

  // ==========================================================================
  // DRAMATIC KICK-OUT FX (Giant Pixel Boot, Smoke Trail, Ground THUD!)
  // ==========================================================================
  function drawKickOutFX(ctx, b, kickout, time) {
    const p = Math.max(0, Math.min(1, kickout.progress));
    const doorX = Math.round(kickout.startX);
    const doorY = Math.round(kickout.startY);
    const dir = kickout.dirX; // +1 right or -1 left
    const pulse = Math.floor(time * 14) % 2;

    // 1. Beat 1 (0..0.38): Red alert burst + GIANT PIXEL BOOT kicking out of doorway!
    if (p < 0.40) {
      const bt = p / 0.40;
      const extend = Math.sin(Math.min(1, bt * 1.4) * Math.PI * 0.5) * 14;
      const bootX = Math.round(doorX + dir * (extend - 4));
      const bootY = doorY - 4;

      // Doorway impact shockwave flash
      if (p < 0.24) {
        const r = Math.round(4 + (p / 0.24) * 14);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          px(ctx, doorX + Math.round(Math.cos(a) * r), doorY + Math.round(Math.sin(a) * r * 0.7), 2, 2, i % 2 === 0 ? USF.alertRed : USF.lemongrass);
        }
      }

      // Giant Comic Pixel Boot!
      ctx.save();
      ctx.translate(bootX, bootY);
      if (dir < 0) ctx.scale(-1, 1);
      // Motion speed-lines behind boot
      px(ctx, -14, -2, 8, 1, USF.white);
      px(ctx, -12, 1, 6, 1, USF.lemongrass);
      px(ctx, -13, 4, 7, 1, USF.white);
      // Boot leg & heel (USF Evergreen + Gold trim!)
      px(ctx, -6, -6, 7, 11, USF.ink);
      px(ctx, -5, -5, 5, 9, USF.evergreen);
      px(ctx, -5, -5, 5, 2, USF.gold);
      // Boot toe cap kicking forward!
      px(ctx, 0, -1, 8, 6, USF.ink);
      px(ctx, 0, 0, 7, 4, USF.green);
      px(ctx, 4, 0, 3, 3, USF.gold); // gold toe cap!
      // Thick sole
      px(ctx, -6, 4, 14, 2, USF.ink);
      ctx.restore();

      // Comic impact starburst right at toe!
      if (p < 0.28) {
        const tag = kickout.reasonType === 'timeout' ? 'TIME UP!' : 'ERROR!';
        drawPixelPill(ctx, tag, doorX, Math.round(b.y) - 13, pulse ? USF.alertRed : USF.ink, USF.white, USF.lemongrass);
      }
    }

    // 2. Beat 2 (0.16..0.78): Smoke puffs & sparks trailing the airborne Bull!
    if (p >= 0.16 && p < 0.78) {
      const flightT = (p - 0.16) / 0.56;
      for (let s = 1; s <= 4; s++) {
        const st = Math.max(0, flightT - s * 0.12);
        const sx = kickout.startX + (kickout.landX - kickout.startX) * st;
        const sy = kickout.startY + (kickout.landY - kickout.startY) * st - Math.sin(st * Math.PI) * 38;
        const size = Math.max(2, 5 - s);
        px(ctx, sx - 1, sy - 1, size, size, s % 2 === 0 ? USF.sand : USF.gold);
      }
      if (p >= 0.28) {
        drawPixelPill(
          ctx,
          'KICKED OUT!',
          Math.round(b.x + b.w / 2),
          Math.round(b.y) - 14 - (pulse ? 2 : 0),
          USF.alertRed,
          USF.lemongrass,
          USF.white
        );
      }
    }

    // 3. Beat 3 (0.70..0.98): Ground landing THUD dust-cloud poof!
    if (p >= 0.70 && p < 0.98) {
      const lt = (p - 0.70) / 0.28;
      const spread = Math.round(4 + lt * 12);
      const lx = Math.round(kickout.landX);
      const ly = Math.round(kickout.landY) + 4;
      px(ctx, lx - spread - 2, ly - 2, 4, 3, USF.sand);
      px(ctx, lx + spread - 2, ly - 2, 4, 3, USF.sand);
      px(ctx, lx - Math.round(spread * 0.5), ly - 4, 3, 3, USF.gold);
      px(ctx, lx + Math.round(spread * 0.5), ly - 4, 3, 3, USF.gold);
      if (lt < 0.55) {
        drawPixelPill(ctx, 'THUD!', lx, ly - 18, USF.ink, USF.lemongrass, USF.alertRed);
      }
    }
  }

  return {
    px,
    drawPixelText,
    drawPixelPill,
    drawPixelTree,
    drawInteractiveBuilding,
    drawConstructionSite,
    drawRibbonCutting,
    drawKickOutFX,
    drawBull,
  };
})();
