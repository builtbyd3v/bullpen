// Shapes from shared/events.md sections 4-7 and Campus layout.

export type Status = "working" | "waiting" | "blocked" | "done";

export type Commit = {
  sha: string;
  message: string;
  files: string[];
  at?: string;
  task?: string;
};

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

export type Lease = {
  file: string;
  agent: string;
  expires_at: string;
  waiters: string[];
};

export type Approval = {
  id: string;
  agent: string;
  tool: string;
  target: string;
  reason: string;
  expires_at?: string;
};

export type BullpenState = {
  main: string;
  worktrees: Worktree[];
  approvals: Approval[];
  leases?: Lease[];
};

export type CheckDecision = "allow" | "ask" | "deny";

export type CheckEvent = {
  agent: string;
  tool: string;
  file: string;
  decision: CheckDecision;
  rule: string;
  latency_ms: number;
  model: string;
  at: string;
};

export type PlanTask = { agent: string; task: string };

export type Plan = {
  ask: string;
  tasks: PlanTask[];
  source?: string;
  started?: boolean;
};

export type HookLog = {
  id: string;
  agent: string;
  event: string;
  tool: string;
  target: string;
  at: string;
};

export type Envelope =
  | { type: "hook"; data: Record<string, unknown> }
  | { type: "state"; data: BullpenState }
  | { type: "commit"; data: { agent: string } & Commit }
  | { type: "undo"; data: { agent: string } }
  | { type: "merge"; data: { agent: string; sha: string; intent?: string } }
  | { type: "check"; data: CheckEvent }
  | { type: "plan"; data: Plan };

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
  zoomedBuildingId: string | null;
  selectedRoomPath: string | null;
};

export type FeedItem = { agent: string; color: string; sha: string; message: string; at: number };

export type Room = {
  name: string;
  path: string;
  files: number;
};

export type Building = {
  id: string;
  name: string;
  folder: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  guarded: boolean;
  files?: number;
  rooms?: Room[];
};
