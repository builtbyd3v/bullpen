import type { Action, BullpenState, Commit, Envelope, Worktree } from "./types.ts";

export const FAKE_STATE: BullpenState = {
  main: "main",
  worktrees: [
    {
      agent: "api",
      color: "#e5484d",
      branch: "agent/api",
      path: "/demo/demo-api",
      task: "Add /users endpoint",
      changed_files: ["api/users.py", "README.md"],
      ahead: 2,
      claims: ["enb"],
      status: "working",
      building: "enb",
      commits: [
        { sha: "a1b2c3d", message: "Add users route", files: ["api/users.py"] },
        { sha: "9f8e7d6", message: "Document users endpoint", files: ["README.md"] },
      ],
    },
    {
      agent: "web",
      color: "#3e63dd",
      branch: "agent/web",
      path: "/demo/demo-web",
      task: "Users page",
      changed_files: ["web/Users.tsx", "api/client.py", "notes/todo.txt"],
      ahead: 1,
      claims: ["msc"],
      status: "working",
      building: "msc",
      commits: [{ sha: "4c5d6e7", message: "Add users page", files: ["web/Users.tsx", "api/client.py"] }],
    },
    {
      agent: "db",
      color: "#f5b400",
      branch: "agent/db",
      path: "/demo/demo-db",
      task: "Users table",
      changed_files: ["db/seed.sql"],
      ahead: 1,
      claims: [],
      status: "waiting",
      building: "enb",
      commits: [{ sha: "1a2b3c4", message: "Seed users", files: ["db/seed.sql"] }],
    },
  ],
  approvals: [{ id: "ap1", agent: "db", tool: "Edit", target: "db/schema.sql", reason: "Sun Dome is guarded" }],
};

let data = FAKE_STATE;

const reset = (w: Worktree): Worktree => ({
  ...w,
  changed_files: [],
  commits: [],
  ahead: 0,
  claims: [],
  building: "bullrunner",
});

// Mirrors the server's section 6 actions so ?fake mode exercises the same dispatch path.
export function fakeServer(action: Action): Envelope[] {
  if (action.kind === "approve") {
    const agent = data.approvals.find((a) => a.id === action.id)?.agent;
    data = {
      worktrees: data.worktrees.map((w) => (w.agent === agent ? { ...w, status: "working" } : w)),
      main: data.main,
      approvals: data.approvals.filter((a) => a.id !== action.id),
    };
    return [{ type: "state", data }];
  }
  const target = data.worktrees.find((w) => w.agent === action.agent);
  const sha = target?.commits[0]?.sha ?? "";
  const intent =
    target && target.commits.length > 0
      ? `Implemented "${target.task}" across ${target.commits.length} commit${target.commits.length === 1 ? "" : "s"} (${target.commits.map((c) => c.message).join("; ")}).`
      : target
        ? `Merged ${target.branch} for "${target.task}".`
        : "";
  data = {
    ...data,
    worktrees: data.worktrees.map((w) =>
      w.agent !== action.agent ? w : action.kind === "merge" ? { ...reset(w), status: "done" } : reset(w),
    ),
  };
  const first: Envelope =
    action.kind === "merge"
      ? { type: "merge", data: { agent: action.agent, sha, intent } }
      : { type: "undo", data: { agent: action.agent } };
  return [first, { type: "state", data }];
}

// What the server's /state would show after an agent commits on its branch.
export function withCommit(state: BullpenState, agent: string, commit: Commit): BullpenState {
  return {
    ...state,
    worktrees: state.worktrees.map((w) =>
      w.agent !== agent
        ? w
        : {
            ...w,
            commits: [commit, ...w.commits],
            ahead: w.ahead + 1,
            changed_files: [...new Set([...w.changed_files, ...commit.files])],
          },
    ),
  };
}

function fakeCommit(agent: string, commit: Commit): Envelope[] {
  data = withCommit(data, agent, commit);
  return [{ type: "commit", data: { agent, ...commit } }, { type: "state", data }];
}

// "Play demo" in ?fake mode: about 15 seconds of envelopes, fed through store.dispatch like the live socket.
export const DEMO: { at: number; run: () => Envelope[] }[] = [
  { at: 1500, run: () => fakeCommit("api", { sha: "b7c8d9e", message: "Test users route", files: ["tests/test_users.py"] }) },
  { at: 4000, run: () => fakeCommit("web", { sha: "e1f2a3b", message: "Fetch users from API", files: ["web/api.ts"] }) },
  { at: 7000, run: () => fakeServer({ kind: "approve", id: "ap1", decision: "allow" }) },
  { at: 8500, run: () => fakeCommit("db", { sha: "c4d5e6f", message: "Add users table", files: ["db/schema.sql"] }) },
  { at: 11000, run: () => fakeServer({ kind: "merge", agent: "api" }) },
  { at: 14000, run: () => fakeServer({ kind: "undo", agent: "web" }) },
];
