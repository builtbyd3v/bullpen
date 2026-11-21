import Phaser from "phaser";
import campus from "../../campus/campus.json" with { type: "json" };
import { buildingForFile, layersByBuilding, waitQueue } from "@/lib/campus.ts";
import type { Store, StoreState } from "@/lib/store.ts";
import type { Building, Fx, Status } from "@/lib/types.ts";
import { drawCampusGround, makeBuilding } from "./buildingSprite";
import { makeBull } from "./bullSprite";

const buildings: Building[] = campus.buildings;
const byId = new Map(buildings.map((b) => [b.id, b]));
const bullrunner = byId.get("bullrunner")!;

type Placed = { color: number; x: number; y: number };
// `wait`: 1-based place in the line at a building door, 0 when not queued.
type BullSpec = Placed & { agent: string; status: Status; wait: number; door: { x: number; y: number } | null };
type ScaffoldSpec = { color: number; b: Building; offset: number };
type ConflictSpec = { colors: number[]; b: Building };
type Obj = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.AlphaSingle;

const tint = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;
// Agent i's slot below building b. Bulls spread from the door; flags line up at the left of the door.
const slotX = (b: Building, i: number, n: number) => b.x + b.w / 2 + 10 + (i - (n - 1) / 2) * 44;
const flagX = (b: Building, i: number) => b.x + 10 + i * 12;
// Bulls stand below the door; when another building sits there (msc over rec), above the roof, else on the front steps.
const hitsBuilding = (b: Building, x: number, y: number) =>
  buildings.some((o) => o !== b && o.id !== "bullrunner" && x > o.x - 20 && x < o.x + o.w + 20 && y + 24 > o.y && y - 24 < o.y + o.h);
const bullY = (b: Building) => {
  const cx = b.x + b.w / 2;
  if (!hitsBuilding(b, cx, b.y + b.h + 44)) return b.y + b.h + 44;
  if (b.y > 56 && !hitsBuilding(b, cx, b.y - 30)) return b.y - 30;
  if (b.y >= 50) return b.y - 24;
  return b.y + b.h - 20;
};
// The door sits at the middle of the building's bottom edge. The line forms to its right, past the agent slots.
const door = (b: Building) => ({ x: b.x + b.w / 2, y: b.y + b.h });
const queueX = (b: Building, pos: number) => b.x + b.w / 2 + 96 + (pos - 1) * 40;
// 5x7 pixel hourglass (2px cells), one frame per quarter turn of the sand: caps, glass, sand.
const HOURGLASS_FRAMES = [0, 1, 2, 3].map((phase) => {
  const rows = ["ccccc", ".gGg.", ".gGg.", "..g..", ".ggg.", ".ggg.", "ccccc"].map((r) => [...r]);
  const sand = (y: number, x0: number, x1: number) => {
    for (let x = x0; x <= x1; x++) rows[y][x] = "s";
  };
  if (phase === 0) (sand(1, 1, 3), sand(2, 1, 3));
  if (phase === 1) (sand(2, 1, 3), sand(3, 2, 2), sand(5, 2, 2));
  if (phase === 2) (sand(2, 2, 2), sand(3, 2, 2), sand(5, 1, 3));
  if (phase === 3) (sand(4, 1, 3), sand(5, 1, 3));
  return rows;
});
const HOURGLASS_FILLS: Record<string, number> = { c: 0xcfc493, g: 0x9fd3e8, G: 0xffffff, s: 0xdbe442 };
// Night navy with a third of the agent's color, so even yellow reads as evening.
const dusk = (hex: string) => {
  const { r, g, b } = Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.ValueToColor(0x0b1033),
    Phaser.Display.Color.HexStringToColor(hex),
    100,
    35,
  );
  return Phaser.Display.Color.GetColor(r, g, b);
};
const agentOf = (key: string) => key.split("|")[0];
const MARKS: Record<Status, [string, string]> = {
  working: ["", "#ffffff"],
  waiting: ["…", "#ffffff"],
  blocked: ["!", "#ff4d4d"],
  done: ["✓", "#4ade80"],
};

export class CampusScene extends Phaser.Scene {
  private store!: Store;
  private bulls = new Map<string, Phaser.GameObjects.Container>();
  private flags = new Map<string, Phaser.GameObjects.Container>();
  private scaffolds = new Map<string, Phaser.GameObjects.Graphics>();
  private conflicts = new Map<string, Phaser.GameObjects.Container>();
  private dusk!: Phaser.GameObjects.Rectangle;
  private selection!: Phaser.GameObjects.Graphics;
  private tethers!: Phaser.GameObjects.Graphics;
  private tooltip!: Phaser.GameObjects.Text;
  private hovered: Building | null = null;
  // Agent -> how its layers leave on the next reconcile. Set by an undo or merge fx, which the server sends just before `state`.
  private exiting = new Map<string, "collapse" | "fade">();

  constructor() {
    super("campus");
  }

  init(data: { store: Store }) {
    this.store = data.store;
  }

  create() {
    drawCampusGround(this, campus.width, campus.height, buildings);
    for (const b of buildings) {
      makeBuilding(
        this,
        b,
        () =>
          this.store.setUi({
            selected: { kind: "building", id: b.id },
            zoomedBuildingId: b.id,
            selectedRoomPath: null,
          }),
        (over) => {
          this.hovered = over ? b : this.hovered === b ? null : this.hovered;
          this.showTooltip(this.store.getState());
        },
      );
    }
    // Branch tab: dusk over the campus in the agent's color, under that agent's layers.
    this.dusk = this.add.rectangle(0, 0, campus.width, campus.height, 0x000000, 1).setOrigin(0).setDepth(0.5).setAlpha(0);
    this.selection = this.add.graphics().setDepth(3.5);
    this.tethers = this.add.graphics().setDepth(3.6);
    this.tooltip = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ffffff",
        backgroundColor: "#0d231bf2",
        padding: { x: 10, y: 8 },
        lineSpacing: 4,
      })
      .setDepth(10)
      .setVisible(false);

    // Render what is already in the store, then follow it. Events before create() would otherwise be lost.
    this.render(this.store.getState());
    const unsubscribers = [this.store.subscribe(() => this.render(this.store.getState())), this.store.onFx((fx) => this.fx(fx))];
    const unsubscribe = () => unsubscribers.forEach((u) => u());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.events.once(Phaser.Scenes.Events.DESTROY, unsubscribe);
  }

  private render({ data, ui }: StoreState) {
    const ws = data.worktrees;
    const index = new Map(ws.map((w, i) => [w.agent, i]));
    const shown = (agent: string) => ui.tab === "main" || ui.tab === agent;

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
        if (b) flags.set(`${w.agent}|${id}`, { color: tint(w.color), x: flagX(b, index.get(w.agent)!), y: b.y + b.h - 44 });
      }
    }
    this.sync(this.flags, flags, (f) => this.flag(f), (o, f) => o.setPosition(f.x, f.y));

    const bulls = new Map<string, BullSpec>();
    const queue = waitQueue(data.leases ?? [], buildings);
    ws.forEach((w, i) => {
      const spot = queue.get(w.agent);
      const queuedAt = spot && byId.get(spot.building);
      if (queuedAt) {
        // In line outside the door of the building that holds the leased file.
        const at = { x: queueX(queuedAt, spot.pos), y: bullY(queuedAt) };
        bulls.set(w.agent, { agent: w.agent, color: tint(w.color), ...at, status: w.status, wait: spot.pos, door: door(queuedAt) });
        return;
      }
      const b = byId.get(w.building) ?? bullrunner;
      // A waiting Bull with no lease line stands under the claim flag of the agent holding its building.
      const owner = w.status === "waiting" ? ws.find((o) => o.agent !== w.agent && o.claims.includes(b.id)) : undefined;
      const x = owner ? flagX(b, index.get(owner.agent)!) + 4 : slotX(b, i, ws.length);
      bulls.set(w.agent, { agent: w.agent, color: tint(w.color), x, y: bullY(b), status: w.status, wait: 0, door: null });
    });
    const sel = ui.selected;
    const updateBull = (o: Phaser.GameObjects.Container, s: BullSpec) => {
      const [mark, markColor] = s.wait ? ["", "#ffffff"] : (MARKS[s.status] ?? MARKS.working);
      (o.getByName("mark") as Phaser.GameObjects.Text).setText(mark).setColor(markColor);
      (o.getByName("badge") as Phaser.GameObjects.Text).setText(`WAIT #${s.wait}`).setVisible(s.wait > 0);
      (o.getByName("hourglass") as Phaser.GameObjects.Graphics).setVisible(s.wait > 0);
      o.setData({ wait: s.wait, door: s.door });
      (o.getByName("ring") as Phaser.GameObjects.Ellipse).setVisible(sel?.kind === "bull" && sel.agent === s.agent);
      return this.walk(o, s);
    };
    this.sync(this.bulls, bulls, (s) => updateBull(this.bull(s), s), updateBull);

    // Tab view: other agents' layers hide, other Bulls dim, and the campus takes the agent's dusk color.
    for (const [key, o] of this.scaffolds) this.fade(o, shown(agentOf(key)) ? 1 : 0);
    for (const [key, o] of this.flags) this.fade(o, shown(agentOf(key)) ? 1 : 0);
    for (const [key, o] of this.conflicts) this.fade(o, ui.tab === "main" || key.split("|")[1].split(",").includes(ui.tab) ? 1 : 0);
    for (const [agent, o] of this.bulls) this.fade(o, shown(agent) ? 1 : 0.3);
    const tab = ws.find((w) => w.agent === ui.tab);
    if (tab) this.dusk.setFillStyle(dusk(tab.color));
    this.fade(this.dusk, tab ? 0.5 : 0);

    this.showTooltip({ data });
    this.selection.clear();
    const picked = sel?.kind === "building" ? byId.get(sel.id) : undefined;
    if (picked) this.selection.lineStyle(4, 0xffe066).strokeRect(picked.x - 4, picked.y - 4, picked.w + 8, picked.h + 8);
  }

  // Hover card: building name and folder, then each agent on it with its task and the file it holds.
  private showTooltip({ data }: Pick<StoreState, "data">) {
    const b = this.hovered;
    if (!b) return void this.tooltip.setVisible(false);
    const leases = data.leases ?? [];
    const lines = [b.name, b.folder === null ? "unmapped" : b.folder || "/", ""];
    for (const w of data.worktrees) {
      const held = leases.filter((l) => l.agent === w.agent && buildingForFile(l.file, buildings) === b.id).map((l) => l.file);
      const waiting = leases.filter((l) => l.waiters.includes(w.agent) && buildingForFile(l.file, buildings) === b.id).map((l) => l.file);
      if (w.building !== b.id && !w.claims.includes(b.id) && !held.length && !waiting.length) continue;
      lines.push(`● ${w.agent}  ${w.status}`, `  ${w.task.length > 44 ? `${w.task.slice(0, 43)}…` : w.task}`);
      for (const f of held) lines.push(`  holds ${f}`);
      for (const f of waiting) lines.push(`  waits for ${f}`);
    }
    if (lines.length === 3) lines.push("No agents here");
    this.tooltip.setText(lines);
    const x = Math.min(b.x + b.w / 2 - this.tooltip.width / 2, campus.width - this.tooltip.width - 8);
    const below = b.y + b.h + 8;
    const y = below + this.tooltip.height < campus.height ? below : b.y - this.tooltip.height - 8;
    this.tooltip.setPosition(Math.max(8, x), Math.max(8, y)).setVisible(true);
  }

  // Waiting Bulls tap a foot, turn the hourglass, and keep a dotted line to the door they wait at.
  update(time: number) {
    const phase = Math.floor(time / 250) % 4;
    this.tethers.clear();
    for (const bull of this.bulls.values()) {
      const body = bull.getByName("body") as Phaser.GameObjects.Graphics;
      const wait = bull.getData("wait") as number | undefined;
      if (!wait) {
        body.y = 0;
        continue;
      }
      body.y = phase % 2 ? -2 : 0;
      if (bull.getData("phase") !== phase) {
        bull.setData("phase", phase);
        const g = (bull.getByName("hourglass") as Phaser.GameObjects.Graphics).clear();
        HOURGLASS_FRAMES[phase].forEach((row, y) =>
          row.forEach((ch, x) => {
            if (HOURGLASS_FILLS[ch] !== undefined) g.fillStyle(HOURGLASS_FILLS[ch]).fillRect(x * 2, y * 2, 2, 2);
          }),
        );
      }
      const d = bull.getData("door") as { x: number; y: number } | null;
      if (!d) continue;
      this.tethers.fillStyle(0xdbe442, 0.7 * bull.alpha);
      const dx = d.x - bull.x;
      const dy = d.y - bull.y + 4;
      const steps = Math.floor(Math.hypot(dx, dy) / 6);
      for (let k = 1; k < steps; k++) this.tethers.fillRect(bull.x - 16 + (dx * k) / steps, bull.y + (dy * k) / steps, 2, 2);
    }
  }

  // Keyed reconcile: destroy what is gone, update what stays, create what is new.
  private sync<T, O extends Obj>(objs: Map<string, O>, wanted: Map<string, T>, create: (v: T) => O, update: (o: O, v: T) => void) {
    for (const [key, o] of objs) {
      if (wanted.has(key)) continue;
      this.remove(key, o);
      objs.delete(key);
    }
    for (const [key, v] of wanted) {
      const o = objs.get(key);
      if (o) update(o, v);
      else objs.set(key, create(v));
    }
  }

  private colorOf(agent: string) {
    return this.store.getState().data.worktrees.find((w) => w.agent === agent)?.color ?? "#ffffff";
  }

  private fx(fx: Fx) {
    if (fx.kind === "commit") {
      const b = byId.get(fx.building);
      if (!b) return;
      const style = { fontFamily: "monospace", fontSize: "28px", fontStyle: "bold", color: this.colorOf(fx.agent), stroke: "#000000", strokeThickness: 4 };
      const plus = this.add.text(b.x + b.w / 2, b.y + 10, "+1", style).setOrigin(0.5).setDepth(5).setScale(0.4);
      this.tweens.add({ targets: plus, scale: 1.2, duration: 200, ease: "Back.easeOut" });
      this.tweens.add({ targets: plus, y: plus.y - 60, alpha: 0, delay: 150, duration: 1000, onComplete: () => plus.destroy() });
      return;
    }
    this.exiting.set(fx.agent, fx.kind === "undo" ? "collapse" : "fade");
    this.time.delayedCall(2000, () => this.exiting.delete(fx.agent));
    if (fx.kind === "undo") this.time.delayedCall(350, () => this.cameras.main.shake(450, 0.012));
  }

  // Keys hold agent names ("api|enb", "enb|api,web"); an exiting agent in the key picks the exit animation.
  private remove(key: string, o: Obj) {
    this.tweens.killTweensOf(o);
    const parts = key.split("|").flatMap((p) => p.split(","));
    const agent = parts.find((p) => this.exiting.has(p));
    if (!agent) return o.destroy();
    const b = o instanceof Phaser.GameObjects.Graphics ? byId.get(parts[1]) : undefined;
    const destroy = () => o.destroy();
    if (this.exiting.get(agent) === "fade") {
      this.tweens.add({ targets: o, alpha: 0, duration: 700, onComplete: destroy });
      if (b) {
        const flash = this.add.rectangle(b.x, b.y, b.w, b.h, tint(this.colorOf(agent)), 0.7).setOrigin(0).setDepth(1.5);
        this.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
      }
      return;
    }
    this.tweens.add({ targets: o, y: o.y + 24, scaleY: 0.05, alpha: 0, angle: Phaser.Math.Between(-8, 8), duration: 450, ease: "Back.easeIn", onComplete: destroy });
    if (!b) return;
    for (let i = 0; i < 6; i++) {
      const puff = this.add.circle(b.x + (b.w * (i + 0.5)) / 6, b.y + b.h, 10, 0xd8c8a8).setDepth(3).setAlpha(0);
      const x = puff.x + Phaser.Math.Between(-16, 16);
      this.tweens.add({ targets: puff, delay: 350, alpha: { from: 0.9, to: 0 }, scale: 2.5, x, y: puff.y - 14, duration: 600, onComplete: () => puff.destroy() });
    }
  }

  // One tween per object and purpose, so a walk never cancels a tab fade.
  private retween(o: Obj, key: string, config: Omit<Phaser.Types.Tweens.TweenBuilderConfig, "targets">) {
    (o.getData(key) as Phaser.Tweens.Tween | undefined)?.stop();
    o.setData(key, this.tweens.add({ targets: o, ...config }));
  }

  private fade(o: Obj, alpha: number) {
    const was: unknown = o.getData("alpha");
    if (was === alpha) return;
    o.setData("alpha", alpha);
    if (was === undefined) o.setAlpha(alpha);
    else this.retween(o, "fade", { alpha, duration: 200 });
  }

  private walk(bull: Phaser.GameObjects.Container, { x, y }: Placed) {
    if (bull.getData("x") === x && bull.getData("y") === y) return bull;
    bull.setData({ x, y });
    this.retween(bull, "walk", { x, y, duration: 900, ease: "Sine.easeInOut" });
    return bull;
  }

  private bull({ agent, color }: BullSpec) {
    const bull = this.add
      .container(slotX(bullrunner, 0, 1), bullY(bullrunner), [
        this.add.ellipse(4, -2, 48, 40).setStrokeStyle(3, 0xffe066).setVisible(false).setName("ring"),
        ...makeBull(this, color).map((o, i) => (i === 0 ? o.setName("body") : o)),
        this.add.graphics({ x: 28, y: -18 }).setVisible(false).setName("hourglass"),
        this.add
          .text(2, -26, "", {
            fontFamily: "monospace",
            fontSize: "11px",
            fontStyle: "bold",
            color: "#dbe442",
            backgroundColor: "#005432",
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5, 1)
          .setVisible(false)
          .setName("badge"),
        this.add
          .text(0, 10, agent, {
            fontFamily: "monospace",
            fontSize: "12px",
            fontStyle: "bold",
            color: "#ffffff",
            stroke: "#0d231b",
            strokeThickness: 3,
            backgroundColor: this.colorOf(agent),
            padding: { x: 4, y: 1 },
          })
          .setOrigin(0.5, 0)
          .setName("tag"),
        this.add
          .text(4, -20, "", { fontFamily: "monospace", fontSize: "18px", fontStyle: "bold", color: "#ffffff" })
          .setOrigin(0.5, 1)
          .setName("mark"),
      ])
      .setDepth(4)
      .setSize(44, 36)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.store.setUi({ selected: { kind: "bull", agent } }));
    return bull;
  }

  // Branch changes on a building: a see-through grid in the agent's color, offset per agent so layers stay visible.
  // Drawn relative to the building's base so it can squash into the ground.
  private scaffold({ color, b, offset }: ScaffoldSpec) {
    const g = this.add.graphics({ x: b.x, y: b.y + b.h }).lineStyle(2, color, 0.5).setDepth(1);
    for (let x = 12 + offset; x < b.w; x += 24) g.lineBetween(x, -b.h, x, 0);
    for (let y = 12 + offset; y < b.h; y += 24) g.lineBetween(0, y - b.h, b.w, y - b.h);
    return g;
  }

  // Two or more branches on one building: a striped flag on the roof that flashes.
  private conflict({ colors, b }: ConflictSpec) {
    const g = this.add.graphics();
    g.lineStyle(2, 0xdddddd).lineBetween(0, -36, 0, 0);
    colors.forEach((c, i) => g.fillStyle(c).fillRect(1, -36 + i * 6, 22, 6));
    const flag = this.add.container(b.x + b.w - 30, b.y, [g]).setDepth(3);
    this.tweens.add({ targets: g, alpha: 0.35, duration: 450, yoyo: true, repeat: -1 });
    flag.once(Phaser.GameObjects.Events.DESTROY, () => this.tweens.killTweensOf(g));
    return flag;
  }

  private flag({ color, x, y }: Placed) {
    const g = this.add.graphics();
    g.lineStyle(2, 0xdddddd).lineBetween(0, 4, 0, 40);
    g.fillStyle(color).fillTriangle(1, 4, 14, 9, 1, 14);
    return this.add.container(x, y, [g]).setDepth(3);
  }
}
