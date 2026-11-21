"use client";

import { useEffect, useRef } from "react";
import Phaser from "phaser";
import campus from "../../campus/campus.json" with { type: "json" };
import type { Store } from "@/lib/store.ts";
import { CampusScene } from "./CampusScene";
import { InteriorScene } from "./InteriorScene";

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
    game.scene.add("interior", InteriorScene, false, { store, buildingId: "" });

    let activeZoom = store.getState().ui.zoomedBuildingId;
    const syncScene = () => {
      const nextZoom = store.getState().ui.zoomedBuildingId;
      if (nextZoom === activeZoom) return;
      activeZoom = nextZoom;
      if (nextZoom) {
        if (game.scene.isActive("campus")) game.scene.sleep("campus");
        if (game.scene.isActive("interior")) game.scene.stop("interior");
        game.scene.start("interior", { store, buildingId: nextZoom });
      } else {
        if (game.scene.isActive("interior")) game.scene.stop("interior");
        if (game.scene.isSleeping("campus")) game.scene.wake("campus");
        else if (!game.scene.isActive("campus")) game.scene.start("campus", { store });
      }
    };

    const unsubscribe = store.subscribe(syncScene);
    return () => {
      unsubscribe();
      game.destroy(true);
    };
  }, [store]);

  return <div ref={parent} className="h-full w-full" />;
}
