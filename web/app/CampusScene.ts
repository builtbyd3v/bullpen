import Phaser from "phaser";
import campus from "../../campus/campus.json" with { type: "json" };
import { layersByBuilding } from "@/lib/campus.ts";
import type { Store, StoreState } from "@/lib/store.ts";
import type { Building } from "@/lib/types.ts";

const buildings: Building[] = campus.buildings;
const byId = new Map(buildings.map((b) => [b.id, b]));
const bullrunner = byId.get("bullrunner")!;

type Placed = { color: number; x: number; y: number };
type BullSpec = Placed & { agent: string };
type ScaffoldSpec = { color: number; b: Building; offset: number };
type ConflictSpec = { colors: number[]; b: Building };

const tint = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;
// Agent i's slot below building b. Bulls spread from the door; flags line up at the left of the door.
const slotX = (b: Building, i: number, n: number) => b.x + b.w / 2 + 10 + (i - (n - 1) / 2) * 44;
const flagX = (b: Building, i: number) => b.x + 10 + i * 12;
const bullY = (b: Building) => b.y + b.h + 44;

export class CampusScene extends Phaser.Scene {
  private store!: Store;
  private bulls = new Map<string, Phaser.GameObjects.Container>();
  private flags = new Map<string, Phaser.GameObjects.Container>();
  private scaffolds = new Map<string, Phaser.GameObjects.Graphics>();
  private conflicts = new Map<string, Phaser.GameObjects.Container>();

  constructor() {
    super("campus");
  }

  init(data: { store: Store }) {
    this.store = data.store;
  }

  create() {
    for (const b of buildings) {
      this.add
        .rectangle(b.x, b.y, b.w, b.h, b.guarded ? 0x5a1f1f : 0x1f3a2e)
        .setOrigin(0)
        .setStrokeStyle(2, b.guarded ? 0xff6b6b : 0x7fd1a8);
      const folder = b.folder === null ? "unmapped" : b.folder || "/";
      this.add
        .text(b.x + 8, b.y + 8, `${b.name}\n${folder}`, {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#ffffff",
          wordWrap: { width: b.w - 16 },
        })
        .setDepth(2);
    }

    // Render what is already in the store, then follow it. Events before create() would otherwise be lost.
    this.render(this.store.getState());
    const unsubscribe = this.store.subscribe(() => this.render(this.store.getState()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.events.once(Phaser.Scenes.Events.DESTROY, unsubscribe);
  }

  private render({ data }: StoreState) {
    const ws = data.worktrees;
    const index = new Map(ws.map((w, i) => [w.agent, i]));

    const color = new Map(ws.map((w) => [w.agent, tint(w.color)]));
    const scaffolds = new Map<string, ScaffoldSpec>();
    const conflicts = new Map<string, ConflictSpec>();
    for (const [id, agents] of layersByBuilding(ws, buildings)) {
      const b = byId.get(id);
      if (!b) continue;
      for (const a of agents) scaffolds.set(`${a}|${id}`, { color: color.get(a)!, b, offset: index.get(a)! * 6 });
      if (agents.length > 1) conflicts.set(`${id}|${agents.join()}`, { colors: agents.map((a) => color.get(a)!), b });
    }
    const noop = () => {};
    this.sync(this.scaffolds, scaffolds, (s) => this.scaffold(s), noop);
    this.sync(this.conflicts, conflicts, (c) => this.conflict(c), noop);

    const flags = new Map<string, Placed>();
    for (const w of ws) {
      for (const id of w.claims) {
        const b = byId.get(id);
        if (b) flags.set(`${w.agent}|${id}`, { color: tint(w.color), x: flagX(b, index.get(w.agent)!), y: b.y + b.h });
      }
    }
    this.sync(this.flags, flags, (f) => this.flag(f), (o, f) => o.setPosition(f.x, f.y));

    const bulls = new Map<string, BullSpec>();
    ws.forEach((w, i) => {
      const b = byId.get(w.building) ?? bullrunner;
      // A waiting Bull stands under the claim flag of the agent holding its building.
      const owner = w.status === "waiting" ? ws.find((o) => o.agent !== w.agent && o.claims.includes(b.id)) : undefined;
      const x = owner ? flagX(b, index.get(owner.agent)!) + 4 : slotX(b, i, ws.length);
      bulls.set(w.agent, { agent: w.agent, color: tint(w.color), x, y: bullY(b) });
    });
    this.sync(this.bulls, bulls, (s) => this.walk(this.bull(s), s), (o, s) => this.walk(o, s));
  }

  // Keyed reconcile: destroy what is gone, update what stays, create what is new.
  private sync<T, O extends Phaser.GameObjects.GameObject>(
    objs: Map<string, O>,
    wanted: Map<string, T>,
    create: (v: T) => O,
    update: (o: O, v: T) => void,
  ) {
    for (const [key, o] of objs) {
      if (wanted.has(key)) continue;
      this.tweens.killTweensOf(o);
      o.destroy();
      objs.delete(key);
    }
    for (const [key, v] of wanted) {
      const o = objs.get(key);
      if (o) update(o, v);
      else objs.set(key, create(v));
    }
  }

  private walk(bull: Phaser.GameObjects.Container, { x, y }: Placed) {
    if (bull.getData("x") === x && bull.getData("y") === y) return bull;
    bull.setData({ x, y });
    this.tweens.killTweensOf(bull);
    this.tweens.add({ targets: bull, x, y, duration: 900, ease: "Sine.easeInOut" });
    return bull;
  }

  private bull({ agent, color }: BullSpec) {
    const horns = this.add.graphics().fillStyle(0xf5f0e1);
    horns.fillTriangle(6, -8, 9, -16, 11, -8).fillTriangle(15, -8, 18, -16, 20, -8);
    return this.add
      .container(slotX(bullrunner, 0, 1), bullY(bullrunner), [
        this.add.ellipse(0, 0, 28, 16, color),
        this.add.circle(13, -5, 7, color),
        horns,
        this.add.text(0, 10, agent, { fontFamily: "monospace", fontSize: "11px", color: "#ffffff" }).setOrigin(0.5, 0),
      ])
      .setDepth(4);
  }

  // Branch changes on a building: a see-through grid in the agent's color, offset per agent so layers stay visible.
  private scaffold({ color, b, offset }: ScaffoldSpec) {
    const g = this.add.graphics().lineStyle(2, color, 0.5).setDepth(1);
    for (let x = b.x + 12 + offset; x < b.x + b.w; x += 24) g.lineBetween(x, b.y, x, b.y + b.h);
    for (let y = b.y + 12 + offset; y < b.y + b.h; y += 24) g.lineBetween(b.x, y, b.x + b.w, y);
    return g;
  }

  // Two or more branches on one building: a striped flag on the roof that flashes.
  private conflict({ colors, b }: ConflictSpec) {
    const g = this.add.graphics();
    g.lineStyle(2, 0xdddddd).lineBetween(0, -36, 0, 0);
    colors.forEach((c, i) => g.fillStyle(c).fillRect(1, -36 + i * 6, 22, 6));
    const flag = this.add.container(b.x + b.w - 30, b.y, [g]).setDepth(3);
    this.tweens.add({ targets: flag, alpha: 0.35, duration: 450, yoyo: true, repeat: -1 });
    return flag;
  }

  private flag({ color, x, y }: Placed) {
    const g = this.add.graphics();
    g.lineStyle(2, 0xdddddd).lineBetween(0, 4, 0, 40);
    g.fillStyle(color).fillTriangle(1, 4, 14, 9, 1, 14);
    return this.add.container(x, y, [g]).setDepth(3);
  }
}
