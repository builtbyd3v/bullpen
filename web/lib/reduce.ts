import campus from "../../campus/campus.json" with { type: "json" };
import { buildingForFile } from "./campus.ts";
import type { BullpenState, Commit, Envelope, FeedItem, Fx, MergeCard } from "./types.ts";

export type Snapshot = { data: BullpenState; feed: FeedItem[]; merges: MergeCard[] };

export function reduce(snapshot: Snapshot, envelope: Envelope): { snapshot: Snapshot; fx: Fx[] } {
  switch (envelope.type) {
    case "state":
      return {
        snapshot: { ...snapshot, data: envelope.data, feed: seedFeed(snapshot.feed, envelope.data) },
        fx: [],
      };
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
    case "merge": {
      const { agent, sha, intent = "" } = envelope.data;
      const worktree = snapshot.data.worktrees.find((w) => w.agent === agent);
      const commits: Commit[] =
        worktree && worktree.commits.length > 0
          ? [...worktree.commits]
          : snapshot.feed
              .filter((f) => f.agent === agent)
              .reverse()
              .map((f) => ({ sha: f.sha, message: f.message, files: [] }));
      const id = sha ? `${agent}:${sha}` : `${agent}:${Date.now()}`;
      const card: MergeCard = {
        id,
        agent,
        color: worktree?.color ?? snapshot.feed.find((f) => f.agent === agent)?.color ?? "#888888",
        branch: worktree?.branch ?? `agent/${agent}`,
        sha,
        intent: intent.trim(),
        commits,
        at: Date.now(),
      };
      const merges = [card, ...snapshot.merges.filter((m) => m.id !== id)];
      return { snapshot: { ...snapshot, merges }, fx: [{ kind: "merge", agent }] };
    }
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
