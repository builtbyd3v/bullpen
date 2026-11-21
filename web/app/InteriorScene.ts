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
    const folder = b.folder === null ? "unmapped" : b.folder || "/";
    // Caua's interior palette (design/mockups-v3 "interior"): sand checker floor, evergreen back wall with a gold rule,
    // tan rooms with desks and monitors, green name signs in gold. Guarded buildings get rose rooms.
    const g = this.add.graphics();
    for (let y = 0; y < H; y += 16) {
      for (let x = (y / 16) % 2 ? 8 : 0; x < W; x += 16) g.fillStyle((x + y) % 32 ? 0xedebd1 : 0xe6eae7).fillRect(x, y, 16, 16);
    }
    g.fillStyle(0x005432).fillRect(0, 0, W, 48);
    g.fillStyle(0xcfc493).fillRect(0, 48, W, 4);
    for (let x = W - 260; x < W - 20; x += 44) g.fillStyle(0x006484).fillRect(x, 10, 28, 24).fillStyle(0x29afce).fillRect(x, 10, 28, 5);
    this.add.text(20, 13, `${b.name}  ${folder}${b.guarded ? "  · guarded" : ""}`, {
      fontFamily: "monospace",
      fontSize: "20px",
      fontStyle: "bold",
      color: "#edebd1",
    });

    // Rooms are the building's subfolders or hot files from campus.json, up to 8 in a 4-wide grid.
    const rooms: Room[] =
      b.rooms && b.rooms.length > 0 ? b.rooms.slice(0, 8) : [{ name: folder, path: b.folder ?? "", files: b.files ?? 0 }];
    const cols = Math.min(4, Math.max(2, Math.ceil(rooms.length / 2)));
    const rows = Math.ceil(rooms.length / cols);
    const padX = 28;
    const topY = 72;
    const gap = 18;
    const roomW = Math.floor((W - padX * 2 - gap * (cols - 1)) / cols);
    const roomH = Math.min(240, Math.floor((H - topY - 70 - gap * (rows - 1)) / rows));
    const roomFill = b.guarded ? 0xf2c9c4 : 0xf3d99c;
    const roomStripe = b.guarded ? 0xe4ada6 : 0xe2be74;

    rooms.forEach((room, i) => {
      const x = padX + (i % cols) * (roomW + gap);
      const y = topY + Math.floor(i / cols) * (roomH + gap);
      this.roomRects.push({ room, x, y, w: roomW, h: roomH });
      g.fillStyle(0x0d231b).fillRect(x - 2, y - 2, roomW + 4, roomH + 4);
      g.fillStyle(roomFill).fillRect(x, y, roomW, roomH);
      for (let sy = y + 30; sy < y + roomH; sy += 12) g.fillStyle(roomStripe).fillRect(x, sy, roomW, 2);
      g.fillStyle(0xa68344).fillRect(x + roomW - 4, y, 4, roomH).fillRect(x, y + roomH - 4, roomW, 4);
      // Desk and monitor at the back of each room.
      const dx = x + roomW / 2 - 28;
      const dy = y + roomH - 44;
      g.fillStyle(0x8a6a43).fillRect(dx, dy, 56, 16).fillStyle(0x5c4630).fillRect(dx, dy + 16, 56, 4);
      g.fillStyle(0x0d231b).fillRect(dx + 16, dy - 18, 24, 18).fillStyle(0x2a6f57).fillRect(dx + 18, dy - 16, 20, 12);
      // Name sign.
      g.fillStyle(0x006747).fillRect(x, y, roomW, 22);
      this.add.text(x + 8, y + 3, room.name.length > 22 ? `${room.name.slice(0, 21)}…` : room.name, {
        fontFamily: "monospace",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#cfc493",
      });
      this.add.text(x + 8, y + 28, room.path || "/", { fontFamily: "monospace", fontSize: "11px", color: "#466069", wordWrap: { width: roomW - 16 } });
      this.add
        .rectangle(x, y, roomW, roomH, 0x000000, 0)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.store.setUi({ selectedRoomPath: room.path }));
    });
    // Door at the bottom of the floor.
    g.fillStyle(0x0d231b).fillRect(W / 2 - 30, H - 24, 60, 24).fillStyle(0x005432).fillRect(W / 2 - 26, H - 20, 52, 20);

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
        const hi = this.add.graphics().lineStyle(4, 0xdbe442).strokeRect(sel.x - 3, sel.y - 3, sel.w + 6, sel.h + 6);
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
          this.add
            .text(0, 12, w.agent, { fontFamily: "monospace", fontSize: "13px", fontStyle: "bold", color: "#ffffff", stroke: "#0d231b", strokeThickness: 3, backgroundColor: w.color, padding: { x: 4, y: 1 } })
            .setOrigin(0.5, 0),
          this.add
            .text(18, -20, mark, { fontFamily: "monospace", fontSize: "16px", fontStyle: "bold", color: markColor })
            .setOrigin(0.5),
        ]);

        this.dynamicLayer.add([post, signBg, signLabel, bullContainer]);
      });
    }
  }
}
