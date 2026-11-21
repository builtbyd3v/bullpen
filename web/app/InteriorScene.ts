import Phaser from "phaser";
import campus from "../../campus/campus.json" with { type: "json" };
import { buildingForFile } from "@/lib/campus.ts";
import type { Store, StoreState } from "@/lib/store.ts";
import type { Building, Room, Status } from "@/lib/types.ts";
import { makeBull } from "./bullSprite";

const buildings: Building[] = campus.buildings;
const byId = new Map(buildings.map((b) => [b.id, b]));
const tint = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

const MARKS: Record<Status, [string, string]> = {
  working: ["", "#ffffff"],
  waiting: ["…", "#ffffff"],
  blocked: ["!", "#ff4d4d"],
  done: ["✓", "#4ade80"],
};

type RoomRect = { room: Room; x: number; y: number; w: number; h: number };

// One shared Phaser interior template for every building (Issue #37).
export class InteriorScene extends Phaser.Scene {
  private store!: Store;
  private buildingId = "";
  private roomRects: RoomRect[] = [];
  private dynamicLayer!: Phaser.GameObjects.Container;

  constructor() {
    super("interior");
  }

  init(data: { store: Store; buildingId: string }) {
    this.store = data.store;
    this.buildingId = data.buildingId;
    this.roomRects = [];
  }

  create() {
    const b = byId.get(this.buildingId);
    if (!b) return;

    const W = campus.width;
    const H = campus.height;
    const accent = b.guarded ? 0xff6b6b : 0x7fd1a8;
    const floorFill = b.guarded ? 0x261214 : 0x12261e;

    // Exterior blueprint frame
    this.add
      .rectangle(24, 24, W - 48, H - 48, floorFill)
      .setOrigin(0)
      .setStrokeStyle(3, accent);

    // Subtle interior floor tile grid
    const grid = this.add.graphics().lineStyle(1, accent, 0.08);
    for (let x = 56; x < W - 24; x += 32) grid.lineBetween(x, 24, x, H - 24);
    for (let y = 56; y < H - 24; y += 32) grid.lineBetween(24, y, W - 24, y);

    // Interior header inside the floorplan
    const folder = b.folder === null ? "unmapped" : b.folder || "/";
    this.add.text(44, 38, `${b.name}  —  ${folder}${b.guarded ? "  [GUARDED]" : ""}`, {
      fontFamily: "monospace",
      fontSize: "18px",
      fontStyle: "bold",
      color: b.guarded ? "#fca5a5" : "#d1fae5",
    });

    // Lay out rooms from campus/campus.json (up to 6 rooms in a clean grid)
    const rooms: Room[] =
      b.rooms && b.rooms.length > 0
        ? b.rooms.slice(0, 6)
        : [{ name: folder, path: b.folder ?? "", files: b.files ?? 0 }];

    const cols = Math.min(3, Math.max(1, rooms.length));
    const rows = Math.ceil(rooms.length / cols);
    const padX = 48;
    const topY = 82;
    const bottomPad = 48;
    const gap = 22;
    const areaW = W - padX * 2;
    const areaH = H - topY - bottomPad;
    const roomW = Math.floor((areaW - gap * (cols - 1)) / cols);
    const roomH = Math.floor((areaH - gap * (rows - 1)) / rows);

    rooms.forEach((room, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padX + col * (roomW + gap);
      const y = topY + row * (roomH + gap);
      this.roomRects.push({ room, x, y, w: roomW, h: roomH });

      // Room box (clickable to inspect diff for that room/file)
      this.add
        .rectangle(x, y, roomW, roomH, b.guarded ? 0x3b1a1c : 0x193429)
        .setOrigin(0)
        .setStrokeStyle(2, accent, 0.7)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.store.setUi({ selectedRoomPath: room.path }));

      // Doorway notch along bottom wall of each room
      this.add.rectangle(x + roomW / 2, y + roomH, 44, 6, floorFill).setOrigin(0.5);

      // Room nameplate
      this.add.text(x + 12, y + 10, room.name, {
        fontFamily: "monospace",
        fontSize: "15px",
        fontStyle: "bold",
        color: "#ffffff",
      });
      this.add.text(x + 12, y + 30, room.path || "/", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#94a3b8",
        wordWrap: { width: roomW - 24 },
      });
    });

    this.dynamicLayer = this.add.container(0, 0).setDepth(5);
    this.render(this.store.getState());
    this.cameras.main.fadeIn(160, 13, 27, 20);

    const unsubscribe = this.store.subscribe(() => this.render(this.store.getState()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.events.once(Phaser.Scenes.Events.DESTROY, unsubscribe);
  }

  private roomForFile(file: string): RoomRect | undefined {
    if (!file || this.roomRects.length === 0) return this.roomRects[0];
    const exact = this.roomRects.find((r) => r.room.path === file);
    if (exact) return exact;
    const prefix = this.roomRects.find((r) => r.room.path.endsWith("/") && file.startsWith(r.room.path));
    if (prefix) return prefix;
    const base = file.split("/").pop();
    const byName = this.roomRects.find((r) => r.room.name === base);
    return byName ?? this.roomRects[0];
  }

  private render({ data, ui }: StoreState) {
    if (!this.dynamicLayer) return;
    this.dynamicLayer.removeAll(true);

    const b = byId.get(this.buildingId);
    if (!b) return;

    // Highlight selected room
    const selectedPath = ui.selectedRoomPath;
    if (selectedPath) {
      const sel = this.roomRects.find((r) => r.room.path === selectedPath);
      if (sel) {
        const hi = this.add.graphics().lineStyle(3, 0xffe066).strokeRect(sel.x - 3, sel.y - 3, sel.w + 6, sel.h + 6);
        this.dynamicLayer.add(hi);
      }
    }

    // Determine which agents are in this building & which room each sits in (preferring active leases!)
    const leases = (data.leases ?? []).filter((l) => buildingForFile(l.file, buildings) === b.id);
    const present = new Map<string, { file: string; leased: boolean }>();

    for (const l of leases) {
      present.set(l.agent, { file: l.file, leased: true });
    }
    for (const w of data.worktrees) {
      if (present.has(w.agent)) continue;
      const matchingFile = w.changed_files.find((f) => buildingForFile(f, buildings) === b.id);
      if (w.building === b.id || matchingFile) {
        present.set(w.agent, { file: matchingFile ?? "", leased: w.claims.includes(b.id) });
      }
    }

    // Group placed agents by room so multiple Bulls in the same room spread cleanly side-by-side
    const byRoom = new Map<RoomRect, { agent: string; file: string; leased: boolean }[]>();
    for (const [agent, info] of present) {
      const rr = this.roomForFile(info.file);
      if (!rr) continue;
      const list = byRoom.get(rr) ?? [];
      list.push({ agent, ...info });
      byRoom.set(rr, list);
    }

    for (const [rr, occupants] of byRoom) {
      occupants.forEach((occ, i) => {
        const w = data.worktrees.find((wt) => wt.agent === occ.agent);
        if (!w) return;
        const colorNum = tint(w.color);
        const cx = rr.x + rr.w / 2 + (i - (occupants.length - 1) / 2) * 76;
        const cy = rr.y + rr.h * 0.68;

        // Room active-lease highlight border
        if (occ.leased) {
          const border = this.add.graphics().lineStyle(2, colorNum, 0.85).strokeRect(rr.x + 2, rr.y + 2, rr.w - 4, rr.h - 4);
          this.dynamicLayer.add(border);
        }

        // Branch sign directly overhead the agent sprite
        const signY = cy - 42;
        const signText = w.branch || `agent/${w.agent}`;
        const signW = Math.max(72, signText.length * 7 + 14);
        const signBg = this.add
          .rectangle(cx, signY, signW, 20, 0x0b1512)
          .setStrokeStyle(2, colorNum);
        const signLabel = this.add
          .text(cx, signY, signText, {
            fontFamily: "monospace",
            fontSize: "11px",
            fontStyle: "bold",
            color: w.color,
          })
          .setOrigin(0.5);
        const post = this.add.graphics().lineStyle(2, colorNum, 0.7).lineBetween(cx, signY + 10, cx, cy - 22);

        const [mark, markColor] = MARKS[w.status] ?? MARKS.working;
        const bullContainer = this.add.container(cx, cy, [
          ...makeBull(this, colorNum),
          this.add.text(0, 12, w.agent, { fontFamily: "monospace", fontSize: "12px", fontStyle: "bold", color: "#ffffff" }).setOrigin(0.5, 0),
          this.add
            .text(18, -20, mark, { fontFamily: "monospace", fontSize: "16px", fontStyle: "bold", color: markColor })
            .setOrigin(0.5),
        ]);

        this.dynamicLayer.add([post, signBg, signLabel, bullContainer]);
      });
    }
  }
}
