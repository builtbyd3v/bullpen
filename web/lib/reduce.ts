import campus from "../../campus/campus.json" with { type: "json" };
import { buildingForFile } from "./campus.ts";
import type { BullpenState, Envelope, FeedItem, Fx } from "./types.ts";

export type Snapshot = { data: BullpenState; feed: FeedItem[] };

export function reduce(snapshot: Snapshot, envelope: Envelope): { snapshot: Snapshot; fx: Fx[] } {
  switch (envelope.type) {
    case "state":
      return { snapshot: { data: envelope.data, feed: seedFeed(snapshot.feed, envelope.data) }, fx: [] };
    case "commit": {
      const { agent, sha, message, files } = envelope.data;
      const color = snapshot.data.worktrees.find((w) => w.agent === agent)?.color ?? "#888888";
      const item: FeedItem = { agent, color, sha, message, at: Date.now() };
      const building = buildingForFile(files[0] ?? "", campus.buildings);
      const feed = snapshot.feed.some((f) => f.sha === sha) ? snapshot.feed : [...snapshot.feed, item];
      return { snapshot: { ...snapshot, feed }, fx: [{ kind: "commit", agent, building }] };
    }
    case "undo":
      return { snapshot, fx: [{ kind: "undo", agent: envelope.data.agent }] };
    case "merge":
      return { snapshot, fx: [{ kind: "merge", agent: envelope.data.agent }] };
    case "hook":
      return { snapshot, fx: [] };
  }
}

// Worktree commits are newest first; append unseen ones oldest first so the feed stays chronological.
export function seedFeed(feed: FeedItem[], data: BullpenState): FeedItem[] {
  const seen = new Set(feed.map((f) => f.sha));
  const fresh = data.worktrees.flatMap((w) =>
    [...w.commits]
      .reverse()
      .filter((c) => !seen.has(c.sha))
      .map((c) => ({ agent: w.agent, color: w.color, sha: c.sha, message: c.message, at: Date.now() })),
  );
  return fresh.length ? [...feed, ...fresh] : feed;
}
