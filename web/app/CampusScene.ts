import Phaser from "phaser";
import campus from "../../campus/campus.json" with { type: "json" };

export class CampusScene extends Phaser.Scene {
  constructor() {
    super("campus");
  }

  create() {
    for (const b of campus.buildings) {
      this.add
        .rectangle(b.x, b.y, b.w, b.h, b.guarded ? 0x5a1f1f : 0x1f3a2e)
        .setOrigin(0)
        .setStrokeStyle(2, b.guarded ? 0xff6b6b : 0x7fd1a8);
      const folder = b.folder === null ? "unmapped" : b.folder || "/";
      this.add.text(b.x + 8, b.y + 8, `${b.name}\n${folder}`, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff",
        wordWrap: { width: b.w - 16 },
      });
    }
  }
}
