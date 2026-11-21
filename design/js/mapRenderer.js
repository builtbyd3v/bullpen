/* ============================================================================
   BULLPEN — Pixel-Art USF Tampa Campus Greenway Map Renderer (512 x 350)
   Exclusively faithful to the provided USF Tampa Campus Greenway reference map.
   ============================================================================ */

window.BullpenMapRenderer = (function () {
  const { USF } = window.BullpenPalette;
  const Data = window.BullpenCampusData;
  const Sprites = window.BullpenSprites;
  const { px } = Sprites;

  class CampusMapRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.canvas.width = Data.WORLD_W;
      this.canvas.height = Data.WORLD_H;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;

      // Offscreen static terrain cache for crisp 60fps pixel rendering
      this.baseCanvas = document.createElement('canvas');
      this.baseCanvas.width = Data.WORLD_W;
      this.baseCanvas.height = Data.WORLD_H;
      this.baseCtx = this.baseCanvas.getContext('2d');
      this.baseCtx.imageSmoothingEnabled = false;

      this.buildStaticTerrain();
    }

    buildStaticTerrain() {
      const ctx = this.baseCtx;
      const W = Data.WORLD_W;
      const H = Data.WORLD_H;

      // 1. Exterior city / map apron outside campus perimeter
      ctx.fillStyle = '#33453E';
      ctx.fillRect(0, 0, W, H);

      // 2. Campus base lawn (USF light green turf with subtle pixel grass dither)
      const B = Data.BORDER;
      px(ctx, B.x, B.y, B.w, B.h, '#B6CE96');

      // Subtle pixel grass texture patches matching campus quads & lawns
      for (let gy = B.y + 2; gy < B.y + B.h - 2; gy += 6) {
        for (let gx = B.x + 2; gx < B.x + B.w - 2; gx += 8) {
          const hash = ((gx * 37 + gy * 17) % 13);
          if (hash < 4) {
            px(ctx, gx, gy, 3, 2, '#A7C385');
          } else if (hash === 5) {
            px(ctx, gx, gy, 2, 1, '#C5DA9F');
          }
        }
      }

      // Soft urban concrete / parking quads (exact zoomed Central Campus pads)
      const quads = [
        [10, 152, 152, 108],  // Engineering / Beard Garage / Juniper-Poplar quad
        [176, 98, 130, 56],   // Collins Garage & EDU plaza
        [244, 198, 64, 72],   // Muma Business quad
        [318, 178, 112, 98],  // Sun Dome concourse & lots
        [124, 10, 92, 50],    // Marshall Student Center / MLK Plaza concrete pad
      ];
      quads.forEach(([qx, qy, qw, qh]) => {
        px(ctx, qx, qy, qw, qh, '#D5DDD7');
        px(ctx, qx + 2, qy + 2, qw - 4, 2, '#B6CE96');
      });

      // John & Grace Legacy Park lush green lawn south of Library + South Alumni Lawn
      px(ctx, 178, 214, 58, 58, '#93BB6E');
      px(ctx, 8, 270, 496, 42, '#9EC378');

      // 3. USF TAMPA CAMPUS GREENWAY — Signature Diagonal Hatched Green Polygons!
      this.drawGreenwayPolygons(ctx);

      // 4. Pond (Castor Pond inside Central Campus Greenway)
      Data.PONDS.forEach(p => this.drawPond(ctx, p));

      // 5. Athletics Fields & Stadiums (East USF Recreation & Athletics)
      Data.ATHLETICS.forEach(a => this.drawAthleticVenue(ctx, a));

      // 6. Campus Roads (Zoomed Central USF Boulevards)
      this.drawRoads(ctx);

      // 7. Official USF Green Campus Frame
      ctx.strokeStyle = USF.green;
      ctx.lineWidth = 2;
      ctx.strokeRect(B.x + 1, B.y + 1, B.w - 2, B.h - 2);

      // 8. Supporting Campus Context Buildings
      Data.CONTEXT_BUILDINGS.forEach(cb => this.drawContextBuilding(ctx, cb));

      // 9. Pixel Trees around campus parks, greenways & lawns
      Data.TREES.forEach(([tx, ty], idx) => Sprites.drawPixelTree(ctx, tx, ty, idx));

      // 10. District Labels (exact zoomed reference map)
      Data.DISTRICT_LABELS.forEach(lbl => {
        Sprites.drawPixelText(ctx, lbl.text, lbl.x, lbl.y, USF.deepForest, 'center', 'rgba(255,255,255,0.55)');
      });

      // 11. Mini Pixel Compass Rose (SW corner inside border)
      this.drawCompassRose(ctx, 20, 298);
    }

    drawGreenwayPolygons(ctx) {
      // Create crisp diagonal-hatched green pattern matching USF Tampa Campus Greenway!
      const patCanvas = document.createElement('canvas');
      patCanvas.width = 6;
      patCanvas.height = 6;
      const pctx = patCanvas.getContext('2d');
      pctx.fillStyle = '#5CA050';
      pctx.fillRect(0, 0, 6, 6);
      pctx.fillStyle = USF.evergreen;
      for (let i = 0; i < 6; i++) {
        pctx.fillRect(i, 5 - i, 1, 1);
        pctx.fillRect((i + 1) % 6, 5 - i, 1, 1);
      }
      const hatch = ctx.createPattern(patCanvas, 'repeat');

      Data.GREENWAY_POLYGONS.forEach(poly => {
        ctx.save();
        ctx.beginPath();
        poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.closePath();
        ctx.fillStyle = hatch;
        ctx.fill();
        ctx.strokeStyle = USF.evergreen;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      });
    }

    drawPond(ctx, p) {
      // Stepped pixel ellipse for crisp retro look
      for (let dy = -p.ry; dy <= p.ry; dy++) {
        const span = Math.round(p.rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (p.ry * p.ry))));
        if (span <= 0) continue;
        // Shore edge
        px(ctx, p.x - span - 1, p.y + dy, span * 2 + 2, 1, USF.seaglass);
        // Water body
        px(ctx, p.x - span, p.y + dy, span * 2, 1, USF.sky);
        // Deep water center
        if (span > 4 && Math.abs(dy) < p.ry * 0.65) {
          px(ctx, p.x - span + 3, p.y + dy, (span - 3) * 2, 1, USF.storm);
        }
      }
    }

    drawAthleticVenue(ctx, a) {
      const { x, y, w, h, type } = a;
      if (type === 'track') {
        // Track & Field Stadium: pixel terracotta oval + lush green infield
        px(ctx, x, y, w, h, '#87A96B');
        px(ctx, x + 4, y + 2, w - 8, h - 4, USF.ink);
        px(ctx, x + 5, y + 3, w - 10, h - 6, '#B86A4B'); // terracotta track
        px(ctx, x + 10, y + 7, w - 20, h - 14, '#5D9B4C'); // green infield
        px(ctx, x + 11, y + 8, w - 22, h - 16, '#77B55A');
      } else if (type === 'football') {
        px(ctx, x, y, w, h, USF.evergreen);
        px(ctx, x + 1, y + 1, w - 2, h - 2, '#5F9E4E');
        // Alternating mowed grass stripes & white yard lines
        for (let lx = x + 4; lx < x + w - 3; lx += 5) {
          px(ctx, lx, y + 2, 1, h - 4, 'rgba(255,255,255,0.55)');
        }
      } else if (type === 'soccer') {
        // Corbett Soccer Park Stadium
        px(ctx, x, y, w, h, USF.slate);
        px(ctx, x + 3, y + 3, w - 6, h - 6, '#599A49');
        px(ctx, x + 4, y + 4, w - 8, h - 8, '#72B256');
        // Center line & boxes
        px(ctx, x + Math.floor(w / 2), y + 4, 1, h - 8, USF.white);
        px(ctx, x + 4, y + 8, 5, h - 16, 'rgba(255,255,255,0.35)');
        px(ctx, x + w - 9, y + 8, 5, h - 16, 'rgba(255,255,255,0.35)');
      } else if (type === 'baseball' || type === 'softball') {
        // Green outfield + sandy pixel infield diamond!
        px(ctx, x, y, w, h, '#599A49');
        px(ctx, x + 2, y + 2, w - 4, h - 4, '#73B258');
        const cx = x + Math.floor(w * 0.45);
        const cy = y + Math.floor(h * 0.58);
        const r = Math.min(w, h) * 0.28;
        for (let dy = -r; dy <= r; dy++) {
          const span = Math.round(r - Math.abs(dy));
          px(ctx, cx - span, cy + dy, span * 2 + 1, 1, USF.gold);
        }
        // Pitcher's mound
        px(ctx, cx, cy, 2, 2, USF.white);
      } else if (type === 'courts') {
        px(ctx, x, y, w, h, USF.evergreen);
        px(ctx, x + 2, y + 2, w - 4, h - 4, USF.teal);
        for (let cx = x + 6; cx < x + w - 3; cx += 5) {
          px(ctx, cx, y + 2, 1, h - 4, USF.white);
        }
      } else {
        px(ctx, x, y, w, h, '#69A754');
      }
    }

    drawRoads(ctx) {
      // First pass: dark road edge borders
      Data.ROADS.forEach(r => {
        ctx.save();
        ctx.strokeStyle = USF.roadDark;
        ctx.lineWidth = r.width + 2;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        r.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
        ctx.restore();
      });

      // Second pass: crisp light asphalt fill
      Data.ROADS.forEach(r => {
        ctx.save();
        ctx.strokeStyle = USF.roadLight;
        ctx.lineWidth = r.width;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        r.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
        ctx.restore();
      });

      // Third pass: subtle dashed center stripes on main boulevards
      const mainStreets = ['USF Leroy Collins Blvd', 'USF Genshaft Dr', 'USF Alumni Dr'];
      Data.ROADS.filter(r => mainStreets.includes(r.name)).forEach(r => {
        ctx.save();
        ctx.strokeStyle = USF.gold;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        r.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
        ctx.restore();
      });
    }

    drawContextBuilding(ctx, cb) {
      const { x, y, w, h, isGarage } = cb;
      px(ctx, x + 2, y + 3, w, h, 'rgba(0, 56, 34, 0.26)');
      px(ctx, x, y, w, h, '#7E6D4D');
      if (isGarage) {
        // Detailed pixel parking garage roof with lanes & ramps
        px(ctx, x + 1, y + 1, w - 2, h - 2, '#D9A773');
        px(ctx, x + 2, y + 2, w - 4, 2, '#E8BE8E');
        for (let py = y + 6; py < y + h - 4; py += 5) {
          px(ctx, x + 3, py, w - 6, 1, '#9E744B');
        }
        px(ctx, x + Math.floor(w / 2), y + 4, 2, h - 8, '#B88959');
      } else {
        px(ctx, x + 1, y + 1, w - 2, h - 2, '#E5C689');
        px(ctx, x + 2, y + 2, w - 4, h - 7, '#EED59F');
        px(ctx, x + 2, y + 2, w - 4, 2, '#F6E5BD');
        // Subtle facade windows
        for (let wx = x + 3; wx < x + w - 4; wx += 5) {
          px(ctx, wx, y + h - 4, 3, 2, '#9A8863');
        }
      }
    }

    drawCompassRose(ctx, cx, cy) {
      px(ctx, cx - 7, cy - 7, 15, 15, USF.evergreen);
      px(ctx, cx - 6, cy - 6, 13, 13, USF.sand);
      // North arrow
      px(ctx, cx, cy - 5, 1, 11, USF.green);
      px(ctx, cx - 2, cy - 3, 5, 1, USF.green);
      px(ctx, cx - 1, cy - 4, 3, 1, USF.green);
      px(ctx, cx - 4, cy, 9, 1, USF.gold);
      Sprites.drawPixelText(ctx, 'N', cx, cy - 13, USF.evergreen, 'center', USF.sand);
    }

    // ========================================================================
    // FRAME RENDER (60 FPS animated pixel campus!)
    // ========================================================================
    render(state, time) {
      const ctx = this.ctx;
      ctx.save();

      // Subtle micro screen-shake during dramatic kick-out impact!
      if (state.screenShake > 0) {
        const sx = Math.round((Math.random() - 0.5) * state.screenShake * 3);
        const sy = Math.round((Math.random() - 0.5) * state.screenShake * 3);
        ctx.translate(sx, sy);
      }

      // 1. Draw pre-rendered static USF Tampa Campus Greenway terrain
      ctx.drawImage(this.baseCanvas, 0, 0);

      // 2. Animated water shimmer glints on ponds
      Data.PONDS.forEach((p, i) => {
        const gx = p.x - Math.floor(p.rx * 0.4) + Math.round(Math.sin(time * 2 + i) * 3);
        const gy = p.y - 2 + ((Math.floor(time * 2 + i) % 2) * 3);
        px(ctx, gx, gy, 4, 1, USF.white);
      });

      // 3. Draw target walk path previews & waiting-line tethers
      state.agents.forEach(agent => {
        const model = window.BullpenPalette.CLAUDE_MODELS[agent.modelId];
        if (agent.state === 'walking' && agent.path && agent.path.length) {
          ctx.save();
          ctx.strokeStyle = model ? model.primary : USF.gold;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(agent.x, agent.y);
          agent.path.forEach(pt => ctx.lineTo(pt.x, pt.y));
          ctx.stroke();
          ctx.restore();
        } else if (agent.state === 'waiting' && agent.targetBuildingId) {
          const b = state.getBuilding(agent.targetBuildingId);
          if (b) {
            ctx.save();
            ctx.strokeStyle = USF.lemongrass;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(agent.x, agent.y);
            ctx.lineTo(b.door.x, b.door.y - 3);
            ctx.stroke();
            ctx.restore();
          }
        }
      });

      // 4. Draw all interactive buildings + active construction sites!
      state.buildings.forEach(b => {
        const status = state.getBuildingStatus(b.id);
        Sprites.drawInteractiveBuilding(ctx, b, {
          hovered: state.hoveredBuildingId === b.id,
          selected: state.selectedBuildingId === b.id,
          status,
          time,
        });

        // Construction elements (cones, scaffolding, animated crane) while working!
        if (status === 'working') {
          Sprites.drawConstructionSite(ctx, b, time);
        }
      });

      // 5. Draw all Bulls (ground -> hovering on roofs -> dramatic airborne kicked-out Bulls!)
      const groundAgents = state.agents.filter(a => a.state !== 'working' && a.state !== 'kicked');
      const hoveringAgents = state.agents.filter(a => a.state === 'working');
      const kickedAgents = state.agents.filter(a => a.state === 'kicked');

      groundAgents.sort((a, b) => a.y - b.y);
      groundAgents.forEach(agent => Sprites.drawBull(ctx, agent, time, state.timeLimitSec));

      // Hovering working Bulls drawn on top of roofs & cranes
      hoveringAgents.forEach(agent => Sprites.drawBull(ctx, agent, time, state.timeLimitSec));

      // 6. Dramatic Kick-Out FX (Giant pixel boot, smoke trail, THUD!) + Airborne Kicked Bulls!
      state.kickouts.forEach(k => {
        const b = state.getBuilding(k.buildingId);
        if (b) {
          Sprites.drawKickOutFX(ctx, b, k, time);
        }
      });
      kickedAgents.forEach(agent => Sprites.drawBull(ctx, agent, time, state.timeLimitSec));

      // 7. Ribbon-cutting celebrations drawn on top so confetti & scissors pop!
      state.ribbons.forEach(rib => {
        const b = state.getBuilding(rib.buildingId);
        if (b) {
          Sprites.drawRibbonCutting(ctx, b, rib.progress);
        }
      });

      // 8. Root Folder Campus Plaque (bottom-right open lawn inside campus border)
      const rootLabel = `ROOT: ${state.rootFolder}`;
      const rw = rootLabel.length * 4 + 12;
      const rx = Data.WORLD_W - rw - 12;
      const ry = Data.WORLD_H - 23;
      px(ctx, rx, ry, rw, 13, USF.ink);
      px(ctx, rx + 1, ry + 1, rw - 2, 11, USF.green);
      px(ctx, rx + 1, ry + 1, rw - 2, 1, USF.gold);
      Sprites.drawPixelText(ctx, rootLabel, rx + 6, ry + 4, USF.gold, 'left');

      ctx.restore();
    }

    // Convert mouse client coordinates to exact 512x350 pixel world coords
    clientToWorld(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * Data.WORLD_W;
      const y = ((clientY - rect.top) / rect.height) * Data.WORLD_H;
      return { x, y };
    }

    // Check which interactive building is under (wx, wy)
    hitTestBuilding(buildings, wx, wy) {
      // Slight generous 3px padding for pleasant pixel clicking
      for (let i = buildings.length - 1; i >= 0; i--) {
        const b = buildings[i];
        if (wx >= b.x - 3 && wx <= b.x + b.w + 3 && wy >= b.y - 4 && wy <= b.y + b.h + 7) {
          return b;
        }
      }
      return null;
    }
  }

  return { CampusMapRenderer };
})();
