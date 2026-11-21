// Shapes from shared/events.md sections 4-6.

export type Status = "working" | "waiting" | "blocked" | "done";

export type Commit = { sha: string; message: string; files: string[] };

export type Worktree = {
  agent: string;
  color: string;
  branch: string;
  path: string;
  task: string;
  changed_files: string[];
  ahead: number;
  claims: string[];
  status: Status;
  building: string;
  commits: Commit[];
};

export type Approval = { id: string; agent: string; tool: string; target: string; reason: string };

export type BullpenState = { main: string; worktrees: Worktree[]; approvals: Approval[] };

export type Envelope =
  | { type: "hook"; data: Record<string, unknown> }
  | { type: "state"; data: BullpenState }
  | { type: "commit"; data: { agent: string } & Commit }
  | { type: "undo"; data: { agent: string } }
  | { type: "merge"; data: { agent: string; sha: string; intent?: string } };

export type MergeCard = {
  id: string;
  agent: string;
  color: string;
  branch: string;
  sha: string;
  intent: string;
  commits: Commit[];
  at: number;
};

export type Fx =
  | { kind: "commit"; agent: string; building: string }
  | { kind: "merge"; agent: string }
  | { kind: "undo"; agent: string };

export type Action =
  | { kind: "undo"; agent: string }
  | { kind: "merge"; agent: string }
  | { kind: "approve"; id: string; decision: "allow" | "deny" };

export type UiState = {
  tab: "main" | string;
  selected: { kind: "building"; id: string } | { kind: "bull"; agent: string } | null;
};

export type FeedItem = { agent: string; color: string; sha: string; message: string; at: number };

export type Building = {
  id: string;
  name: string;
  folder: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  guarded: boolean;
};
