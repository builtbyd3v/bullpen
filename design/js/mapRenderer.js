/* ============================================================================
   BULLPEN — Adaptive Cropping Pixel-Art USF Tampa Campus Map Renderer
   Pre-renders the 580 x 364 USF Tampa Campus Greenway master map and crops
   dynamically around all active repository folders so every folder is visible.
   ============================================================================ */

window.BullpenMapRenderer = (function () {
  const { USF } = window.BullpenPalette;
  const Data = window.BullpenCampusData;
  const Sprites = window.BullpenSprites;
  const { px } = Sprites;

  class CampusMapRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.crop = { x: 0, y: 0, w: Data.WORLD_W, h: Data.WORLD_H, tierLabel: 'FULL CAMPUS' };

      // Offscreen static master terrain cache (580 x 364)
      this.baseCanvas = document.createElement('canvas');
      this.baseCanvas.width = Data.WORLD_W;
      this.baseCanvas.height = Data.WORLD_H;
      this.baseCtx = this.baseCanvas.getContext('2d');
      this.baseCtx.imageSmoothingEnabled = false;

      this.buildStaticTerrain();
      this.applyCrop(this.crop);
    }

    applyCrop(crop) {
      if (!crop) return;
      this.crop = { ...crop };
      if (this.canvas.width !== crop.w || this.canvas.height !== crop.h) {
        this.canvas.width = crop.w;
        this.canvas.height = crop.h;
        this.ctx.imageSmoothingEnabled = false;
      }
      const frame = this.canvas.parentElement;
      if (frame) {
        frame.style.aspectRatio = `${crop.w} / ${crop.h}`;
      }
    }

    buildStaticTerrain() {
      const ctx = this.baseCtx;
      const W = Data.WORLD_W;
      const H = Data.WORLD_H;

      // 1. Campus base lawn (USF light green turf with subtle pixel grass dither)
      px(ctx, 0, 0, W, H, '#B6CE96');

      for (let gy = 2; gy < H - 2; gy += 6) {
        for (let gx = 2; gx < W - 2; gx += 8) {
          const hash = ((gx * 37 + gy * 17) % 13);
          if (hash < 4) {
            px(ctx, gx, gy, 3, 2, '#A7C385');
          } else if (hash === 5) {
            px(ctx, gx, gy, 2, 1, '#C5DA9F');
          }
        }
      }

      // 2. Concrete / plaza quads matching the USF Tampa Central Campus reference map
      const quads = [
        [14, 160, 168, 108],  // Engineering / Beard Garage / Juniper-Poplar quad
        [198, 106, 130, 56],  // Collins Garage & EDU plaza
        [266, 206, 64, 72],   // Muma Business quad
        [340, 186, 114, 98],  // Sun Dome concourse & lots
        [146, 18, 92, 52],    // Marshall Student Center / MLK Plaza pad
      ];
      quads.forEach(([qx, qy, qw, qh]) => {
        px(ctx, qx, qy, qw, qh, '#D5DDD7');
        px(ctx, qx + 2, qy + 2, qw - 4, 2, '#B6CE96');
      });

      // Legacy Park (south of Library) & South Campus Lawn
      px(ctx, 200, 222, 58, 58, '#93BB6E');
      px(ctx, 4, 280, W - 8, 80, '#9EC378');

      // 3. Diagonal-hatched USF Tampa Campus Greenway corridors
      this.drawGreenwayPolygons(ctx);

      // 4. Castor Pond
      Data.PONDS.forEach(p => this.drawPond(ctx, p));

      // 5. USF Recreation & Athletics venues
      Data.ATHLETICS.forEach(a => this.drawAthleticVenue(ctx, a));

      // 6. Campus Roads
      this.drawRoads(ctx);

      // 7. Always-context supporting structures (garages & minor halls)
      Data.CONTEXT_BUILDINGS.forEach(cb => this.drawContextBuilding(ctx, cb));

      // 8. Pixel Trees around campus parks, greenways & lawns
      Data.TREES.forEach(([tx, ty], idx) => Sprites.drawPixelTree(ctx, tx, ty, idx));

      // 9. District Labels
      Data.DISTRICT_LABELS.forEach(lbl => {
        Sprites.drawPixelText(ctx, lbl.text, lbl.x, lbl.y, USF.sand, 'center', USF.deepForest);
      });
    }

    drawGreenwayPolygons(ctx) {
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
      for (let dy = -p.ry; dy <= p.ry; dy++) {
        const span = Math.round(p.rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (p.ry * p.ry))));
        if (span <= 0) continue;
        px(ctx, p.x - span - 1, p.y + dy, span * 2 + 2, 1, USF.seaglass);
        px(ctx, p.x - span, p.y + dy, span * 2, 1, USF.sky);
        if (span > 4 && Math.abs(dy) < p.ry * 0.65) {
          px(ctx, p.x - span + 3, p.y + dy, (span - 3) * 2, 1, USF.storm);
        }
      }
    }

    drawAthleticVenue(ctx, a) {
      const { x, y, w, h, type } = a;
      if (type === 'track') {
        px(ctx, x, y, w, h, '#87A96B');
        px(ctx, x + 4, y + 2, w - 8, h - 4, USF.ink);
        px(ctx, x + 5, y + 3, w - 10, h - 6, '#B86A4B');
        px(ctx, x + 10, y + 7, w - 20, h - 14, '#5D9B4C');
        px(ctx, x + 11, y + 8, w - 22, h - 16, '#77B55A');
      } else if (type === 'football') {
        px(ctx, x, y, w, h, USF.evergreen);
        px(ctx, x + 1, y + 1, w - 2, h - 2, '#5F9E4E');
        for (let lx = x + 5; lx < x + w - 4; lx += 6) {
          px(ctx, lx, y + 2, 1, h - 4, 'rgba(255,255,255,0.55)');
        }
      } else if (type === 'soccer') {
        px(ctx, x, y, w, h, USF.slate);
        px(ctx, x + 3, y + 3, w - 6, h - 6, '#599A49');
        px(ctx, x + 4, y + 4, w - 8, h - 8, '#72B256');
        px(ctx, x + Math.floor(w / 2), y + 4, 1, h - 8, USF.white);
        px(ctx, x + 4, y + 10, 6, h - 20, 'rgba(255,255,255,0.35)');
        px(ctx, x + w - 10, y + 10, 6, h - 20, 'rgba(255,255,255,0.35)');
      } else if (type === 'baseball' || type === 'softball') {
        px(ctx, x, y, w, h, '#599A49');
        px(ctx, x + 2, y + 2, w - 4, h - 4, '#73B258');
        const cx = x + Math.floor(w * 0.45);
        const cy = y + Math.floor(h * 0.58);
        const r = Math.min(w, h) * 0.28;
        for (let dy = -r; dy <= r; dy++) {
          const span = Math.round(r - Math.abs(dy));
          px(ctx, cx - span, cy + dy, span * 2 + 1, 1, USF.gold);
        }
        px(ctx, cx, cy, 2, 2, USF.white);
      } else if (type === 'courts') {
        px(ctx, x, y, w, h, USF.evergreen);
        px(ctx, x + 2, y + 2, w - 4, h - 4, USF.teal);
        for (let cx = x + 7; cx < x + w - 4; cx += 6) {
          px(ctx, cx, y + 2, 1, h - 4, USF.white);
        }
      } else {
        px(ctx, x, y, w, h, '#69A754');
      }
    }

    drawRoads(ctx) {
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
        for (let wx = x + 3; wx < x + w - 4; wx += 5) {
          px(ctx, wx, y + h - 4, 3, 2, '#9A8863');
        }
      }
    }

    drawCompassRose(ctx, cx, cy) {
      px(ctx, cx - 7, cy - 7, 15, 15, USF.evergreen);
      px(ctx, cx - 6, cy - 6, 13, 13, USF.sand);
      px(ctx, cx, cy - 5, 1, 11, USF.green);
      px(ctx, cx - 2, cy - 3, 5, 1, USF.green);
      px(ctx, cx - 1, cy - 4, 3, 1, USF.green);
      px(ctx, cx - 4, cy, 9, 1, USF.gold);
      Sprites.drawPixelText(ctx, 'N', cx, cy - 13, USF.evergreen, 'center', USF.sand);
    }

    // ========================================================================
    // FRAME RENDER (60 FPS dynamically cropped pixel campus!)
    // ========================================================================
    render(state, time) {
      if (state.cropRect && (
        state.cropRect.x !== this.crop.x ||
        state.cropRect.y !== this.crop.y ||
        state.cropRect.w !== this.crop.w ||
        state.cropRect.h !== this.crop.h
      )) {
        this.applyCrop(state.cropRect);
      }

      const crop = this.crop;
      const ctx = this.ctx;
      ctx.save();

      // Micro screen-shake during dramatic kick-out impact
      if (state.screenShake > 0) {
        const sx = Math.round((Math.random() - 0.5) * state.screenShake * 3);
        const sy = Math.round((Math.random() - 0.5) * state.screenShake * 3);
        ctx.translate(sx, sy);
      }

      // 1. Draw the dynamically cropped slice of the USF Tampa Campus terrain
      ctx.drawImage(this.baseCanvas, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);

      // 2. Enter world-space offset by (-crop.x, -crop.y)
      ctx.save();
      ctx.translate(-crop.x, -crop.y);

      // Animated water shimmer glints on ponds
      Data.PONDS.forEach((p, i) => {
        const gx = p.x - Math.floor(p.rx * 0.4) + Math.round(Math.sin(time * 2 + i) * 3);
        const gy = p.y - 2 + ((Math.floor(time * 2 + i) % 2) * 3);
        px(ctx, gx, gy, 4, 1, USF.white);
      });

      // Walk path previews & waiting-line tethers
      state.agents.forEach(agent => {
        const model = window.BullpenPalette.AGENT_COLORS[agent.modelId];
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

      // Draw ONLY the active repository buildings (exact count matching analyzed repo!)
      state.buildings.forEach(b => {
        const status = state.getBuildingStatus(b.id);
        Sprites.drawInteractiveBuilding(ctx, b, {
          hovered: state.hoveredBuildingId === b.id,
          selected: state.selectedBuildingId === b.id,
          status,
          time,
        });

        if (status === 'working') {
          Sprites.drawConstructionSite(ctx, b, time);
        }
      });

      // Draw Bulls: ground -> hovering working -> kickout FX & airborne kicked Bulls
      const groundAgents = state.agents.filter(a => a.state !== 'working' && a.state !== 'kicked');
      const hoveringAgents = state.agents.filter(a => a.state === 'working');
      const kickedAgents = state.agents.filter(a => a.state === 'kicked');

      groundAgents.sort((a, b) => a.y - b.y);
      groundAgents.forEach(agent => Sprites.drawBull(ctx, agent, time, state.timeLimitSec));
      hoveringAgents.forEach(agent => Sprites.drawBull(ctx, agent, time, state.timeLimitSec));

      state.kickouts.forEach(k => {
        const b = state.getBuilding(k.buildingId);
        if (b) Sprites.drawKickOutFX(ctx, b, k, time);
      });
      kickedAgents.forEach(agent => Sprites.drawBull(ctx, agent, time, state.timeLimitSec));

      state.ribbons.forEach(rib => {
        const b = state.getBuilding(rib.buildingId);
        if (b) Sprites.drawRibbonCutting(ctx, b, rib.progress);
      });

      ctx.restore(); // exit world space -> back to cropped screen space (0..crop.w, 0..crop.h)

      // 3. Screen-space USF Green Border Frame, Compass Rose, & Root Folder Plaque
      ctx.strokeStyle = USF.green;
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, crop.w - 2, crop.h - 2);

      this.drawCompassRose(ctx, 16, crop.h - 16);

      const rootLabel = `${state.rootFolder} (${state.buildings.length})`;
      const rw = rootLabel.length * 4 + 12;
      const rx = crop.w - rw - 6;
      const ry = crop.h - 18;
      px(ctx, rx, ry, rw, 13, USF.ink);
      px(ctx, rx + 1, ry + 1, rw - 2, 11, USF.green);
      px(ctx, rx + 1, ry + 1, rw - 2, 1, USF.gold);
      Sprites.drawPixelText(ctx, rootLabel, rx + 6, ry + 4, USF.gold, 'left');

      ctx.restore();
    }

    // Convert mouse client coords -> exact world coordinates through the active crop!
    clientToWorld(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const nx = (clientX - rect.left) / rect.width;
      const ny = (clientY - rect.top) / rect.height;
      return {
        x: this.crop.x + nx * this.crop.w,
        y: this.crop.y + ny * this.crop.h,
      };
    }

    hitTestBuilding(buildings, wx, wy) {
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
