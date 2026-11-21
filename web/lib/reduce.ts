import campus from "../../campus/campus.json" with { type: "json" };
import { buildingForFile } from "./campus.ts";
import type { BullpenState, Envelope, FeedItem, Fx } from "./types.ts";

export type Snapshot = { data: BullpenState; feed: FeedItem[] };

export function reduce(snapshot: Snapshot, envelope: Envelope): { snapshot: Snapshot; fx: Fx[] } {
  switch (envelope.type) {
    case "state":
      return { snapshot: { ...snapshot, data: envelope.data }, fx: [] };
    case "commit": {
      const { agent, sha, message, files } = envelope.data;
      const color = snapshot.data.worktrees.find((w) => w.agent === agent)?.color ?? "#888888";
      const item: FeedItem = { agent, color, sha, message, at: Date.now() };
      const building = buildingForFile(files[0] ?? "", campus.buildings);
      return { snapshot: { ...snapshot, feed: [...snapshot.feed, item] }, fx: [{ kind: "commit", agent, building }] };
    }
    case "undo":
      return { snapshot, fx: [{ kind: "undo", agent: envelope.data.agent }] };
    case "merge":
      return { snapshot, fx: [{ kind: "merge", agent: envelope.data.agent }] };
    case "hook":
      return { snapshot, fx: [] };
  }
}
