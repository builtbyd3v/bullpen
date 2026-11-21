import campus from "../../campus/campus.json" with { type: "json" };
import { buildingForFile } from "./campus.ts";
import type {
  BullpenState,
  CheckEvent,
  Commit,
  Envelope,
  FeedItem,
  Fx,
  HookLog,
  Lease,
  MergeCard,
  Plan,
  Worktree,
} from "./types.ts";

export type Snapshot = {
  data: BullpenState;
  feed: FeedItem[];
  merges: MergeCard[];
  checks: CheckEvent[];
  plan: Plan | null;
  hooks: HookLog[];
  // A short message the UI shows until dismissed (secret guard, failed action).
  notice: string | null;
  replaying: boolean;
};

const MAX_CHECKS = 60;
const MAX_HOOKS = 100;

let hookSeq = 0;

const withData = (s: Snapshot, patch: Partial<BullpenState>): Snapshot => ({ ...s, data: { ...s.data, ...patch } });
const withLeases = (s: Snapshot, map: (leases: Lease[]) => Lease[]) => withData(s, { leases: map(s.data.leases ?? []) });
const moveTo = (s: Snapshot, agent: string, building: string): Snapshot =>
  withData(s, { worktrees: s.data.worktrees.map((w): Worktree => (w.agent === agent ? { ...w, building } : w)) });

function parseHookLog(data: Record<string, unknown>): HookLog | null {
  const agent = typeof data.agent === "string" && data.agent ? data.agent : "";
  const event =
    typeof data.event === "string" && data.event
      ? data.event
      : typeof data.hook_event_name === "string"
        ? data.hook_event_name
        : "";
  if (!agent && !event) return null;
  const tool = typeof data.tool_name === "string" ? data.tool_name : "";
  const input =
    typeof data.tool_input === "object" && data.tool_input !== null
      ? (data.tool_input as Record<string, unknown>)
      : null;
  const file =
    (typeof input?.file_path === "string" && input.file_path) ||
    (typeof input?.command === "string" && input.command) ||
    (typeof data.message === "string" && data.message) ||
    "";
  const at = typeof data.at === "string" && data.at ? data.at : new Date().toISOString();
  return {
    id: `hk-${++hookSeq}`,
    agent: agent || "unknown",
    event: event || "Hook",
    tool,
    target: file,
    at,
  };
}

export function reduce(snapshot: Snapshot, envelope: Envelope): { snapshot: Snapshot; fx: Fx[] } {
  const replaying = Boolean(envelope.replay);
  const withReplay = (next: Snapshot): Snapshot =>
    next.replaying === replaying ? next : { ...next, replaying };

  switch (envelope.type) {
    case "state":
      return {
        snapshot: withReplay({ ...snapshot, data: envelope.data, feed: seedFeed(snapshot.feed, envelope.data) }),
        fx: [],
      };
    case "commit": {
      const { agent, sha, message, files } = envelope.data;
      const color = snapshot.data.worktrees.find((w) => w.agent === agent)?.color ?? "#888888";
      const item: FeedItem = { agent, color, sha, message, at: Date.now() };
      const building = buildingForFile(files[0] ?? "", campus.buildings);
      const feed = snapshot.feed.some((f) => f.sha === sha) ? snapshot.feed : [...snapshot.feed, item];
      return { snapshot: withReplay({ ...snapshot, feed }), fx: [{ kind: "commit", agent, building }] };
    }
    case "undo":
      return { snapshot: withReplay(snapshot), fx: [{ kind: "undo", agent: envelope.data.agent }] };
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
      return { snapshot: withReplay({ ...snapshot, merges }), fx: [{ kind: "merge", agent }] };
    }
    case "check": {
      const checks = [envelope.data, ...snapshot.checks].slice(0, MAX_CHECKS);
      return { snapshot: withReplay({ ...snapshot, checks }), fx: [] };
    }
    case "plan":
      return { snapshot: withReplay({ ...snapshot, plan: envelope.data }), fx: [] };
    case "hook": {
      const entry = parseHookLog(envelope.data);
      if (!entry) return { snapshot: withReplay(snapshot), fx: [] };
      const hooks = [entry, ...snapshot.hooks].slice(0, MAX_HOOKS);
      return { snapshot: withReplay({ ...snapshot, hooks }), fx: [] };
    }
    // Claim and approval events patch data until the `state` the server sends right after replaces it.
    case "claim_wait": {
      const { agent, file, building, holder } = envelope.data;
      const lease = snapshot.data.leases?.find((l) => l.file === file) ?? { file, agent: holder, expires_at: "", waiters: [] };
      const queued = lease.waiters.includes(agent) ? lease : { ...lease, waiters: [...lease.waiters, agent] };
      const next = withLeases(snapshot, (ls) => [...ls.filter((l) => l.file !== file), queued]);
      return { snapshot: moveTo(next, agent, building), fx: [] };
    }
    case "claim_granted": {
      const { agent, file, building, expires_at } = envelope.data;
      const waiters = snapshot.data.leases?.find((l) => l.file === file)?.waiters.filter((a) => a !== agent) ?? [];
      const next = withLeases(snapshot, (ls) => [...ls.filter((l) => l.file !== file), { file, agent, expires_at, waiters }]);
      return { snapshot: moveTo(next, agent, building), fx: [] };
    }
    case "claim_released": {
      const { agent, file } = envelope.data;
      return { snapshot: withLeases(snapshot, (ls) => ls.filter((l) => !(l.file === file && l.agent === agent))), fx: [] };
    }
    case "approval_needed": {
      const approvals = snapshot.data.approvals.filter((a) => a.id !== envelope.data.id);
      return { snapshot: withData(snapshot, { approvals: [...approvals, envelope.data] }), fx: [] };
    }
    case "approved":
    case "denied": {
      const approvals = snapshot.data.approvals.filter((a) => a.id !== envelope.data.id);
      return { snapshot: withData(snapshot, { approvals }), fx: [] };
    }
    case "secret_blocked": {
      const { agent, file, kind } = envelope.data;
      return { snapshot: { ...snapshot, notice: `Secret guard blocked ${agent}'s edit to ${file} (${kind}).` }, fx: [] };
    }
    default:
      // Section 4: clients ignore types they do not know.
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
