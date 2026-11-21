"use client";

import { useEffect, useRef } from "react";
import Phaser from "phaser";
import campus from "../../campus/campus.json" with { type: "json" };
import type { Store } from "@/lib/store.ts";
import { CampusScene } from "./CampusScene";

type CampusProps = { store: Store };

export default function Campus({ store }: CampusProps) {
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
      scene: [],
    });
    game.scene.add("campus", CampusScene, true, { store });
    return () => game.destroy(true);
  }, [store]);

  return <div ref={parent} className="h-full w-full" />;
}
