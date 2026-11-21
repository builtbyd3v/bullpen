"use client";

import { useEffect, useRef } from "react";
import Phaser from "phaser";
import campus from "../../campus/campus.json" with { type: "json" };
import { CampusScene } from "./CampusScene";

export default function Campus() {
  const parent = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!parent.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parent.current,
      width: campus.width,
      height: campus.height,
      backgroundColor: "#0d1b14",
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [CampusScene],
    });
    return () => game.destroy(true);
  }, []);

  return <div ref={parent} className="h-full w-full" />;
}
