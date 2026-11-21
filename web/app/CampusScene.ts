import Phaser from "phaser";
import campus from "../../campus/campus.json" with { type: "json" };
import { layersByBuilding } from "@/lib/campus.ts";
import type { Store, StoreState } from "@/lib/store.ts";
import type { Building, Fx, Status } from "@/lib/types.ts";

const buildings: Building[] = campus.buildings;
const byId = new Map(buildings.map((b) => [b.id, b]));
const bullrunner = byId.get("bullrunner")!;

type Placed = { color: number; x: number; y: number };
type BullSpec = Placed & { agent: string; status: Status };
type ScaffoldSpec = { color: number; b: Building; offset: number };
type ConflictSpec = { colors: number[]; b: Building };
type Obj = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.AlphaSingle;

const tint = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;
// Agent i's slot below building b. Bulls spread from the door; flags line up at the left of the door.
const slotX = (b: Building, i: number, n: number) => b.x + b.w / 2 + 10 + (i - (n - 1) / 2) * 44;
const flagX = (b: Building, i: number) => b.x + 10 + i * 12;
const bullY = (b: Building) => b.y + b.h + 44;
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
  // Agent -> how its layers leave on the next reconcile. Set by an undo or merge fx, which the server sends just before `state`.
  private exiting = new Map<string, "collapse" | "fade">();

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
        .setStrokeStyle(2, b.guarded ? 0xff6b6b : 0x7fd1a8)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.store.setUi({ selected: { kind: "building", id: b.id } }));
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
    // Branch tab: dusk over the campus in the agent's color, under that agent's layers.
    this.dusk = this.add.rectangle(0, 0, campus.width, campus.height, 0x000000, 1).setOrigin(0).setDepth(0.5).setAlpha(0);
    this.selection = this.add.graphics().setDepth(3.5);

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
      bulls.set(w.agent, { agent: w.agent, color: tint(w.color), x, y: bullY(b), status: w.status });
    });
    const sel = ui.selected;
    const updateBull = (o: Phaser.GameObjects.Container, s: BullSpec) => {
      const [mark, markColor] = MARKS[s.status] ?? MARKS.working;
      (o.getByName("mark") as Phaser.GameObjects.Text).setText(mark).setColor(markColor);
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

    this.selection.clear();
    const picked = sel?.kind === "building" ? byId.get(sel.id) : undefined;
    if (picked) this.selection.lineStyle(4, 0xffe066).strokeRect(picked.x - 4, picked.y - 4, picked.w + 8, picked.h + 8);
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

  // The Bull's body: 20x15 pixel art (2px cells) facing right, in the agent's color.
  // No dark outline (it vanishes on the campus); a darker shade of the color marks the underside and far legs.
  private makeBull(color: number): Phaser.GameObjects.GameObject[] {
    const rows = [
      "..............h....h",
      "..............h....h",
      "..............hh..hh",
      ".....cccc.....hhhh..",
      "....cccccccc..ccccc.",
      ".d.ccccccccccdccccc.",
      ".dcccccccccccdeepcc.",
      ".dcccccccccccdcctttt",
      "..cccccccccccccctttt",
      "..ddddddddddddddddd.",
      "...cc.dd....cc.dd...",
      "...cc.dd....cc.dd...",
      "...cc.dd....cc.dd...",
      "...cc.dd....cc.dd...",
      "...kk.kk....kk.kk...",
    ];
    const shade = Phaser.Display.Color.IntegerToColor(color).darken(40).color;
    const fills: Record<string, number> = { c: color, d: shade, t: 0xd9b382, h: 0xf5f0e1, e: 0xffffff, p: 0x1b1b2f, k: 0x2a2a40 };
    const g = this.add.graphics();
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (fills[ch] !== undefined) g.fillStyle(fills[ch]).fillRect(-16 + x * 2, -22 + y * 2, 2, 2);
      }),
    );
    return [g];
  }

  private bull({ agent, color }: BullSpec) {
    const bull = this.add
      .container(slotX(bullrunner, 0, 1), bullY(bullrunner), [
        this.add.ellipse(4, -2, 48, 40).setStrokeStyle(3, 0xffe066).setVisible(false).setName("ring"),
        ...this.makeBull(color),
        this.add.text(0, 10, agent, { fontFamily: "monospace", fontSize: "11px", color: "#ffffff" }).setOrigin(0.5, 0),
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
