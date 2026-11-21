import type { Action, BullpenState, Envelope, Worktree } from "./types.ts";

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
    data = { ...data, approvals: data.approvals.filter((a) => a.id !== action.id) };
    return [{ type: "state", data }];
  }
  const sha = data.worktrees.find((w) => w.agent === action.agent)?.commits[0]?.sha ?? "";
  data = {
    ...data,
    worktrees: data.worktrees.map((w) =>
      w.agent !== action.agent ? w : action.kind === "merge" ? { ...reset(w), status: "done" } : reset(w),
    ),
  };
  const first: Envelope =
    action.kind === "merge" ? { type: "merge", data: { agent: action.agent, sha } } : { type: "undo", data: { agent: action.agent } };
  return [first, { type: "state", data }];
}
