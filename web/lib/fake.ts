import type { Action, BullpenState, CheckEvent, Commit, Envelope, Plan, Worktree } from "./types.ts";

const futureIso = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();
const pastIso = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

export const FAKE_STATE: BullpenState = {
  main: "main",
  worktrees: [
    {
      agent: "api",
      color: "#e5484d",
      branch: "agent/api",
      path: "/demo/demo-api",
      task: "Add /users endpoint",
      changed_files: ["api/users.py", "shared/auth.ts", "README.md"],
      ahead: 2,
      claims: ["enb", "library"],
      status: "working",
      building: "enb",
      commits: [
        {
          sha: "a1b2c3d",
          message: "Add users route",
          files: ["api/users.py"],
          at: pastIso(45),
          task: "Add /users endpoint",
        },
        {
          sha: "9f8e7d6",
          message: "Document users endpoint",
          files: ["README.md"],
          at: pastIso(95),
          task: "Add /users endpoint",
        },
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
      commits: [
        {
          sha: "4c5d6e7",
          message: "Add users page",
          files: ["web/Users.tsx", "api/client.py"],
          at: pastIso(60),
          task: "Users page",
        },
      ],
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
      commits: [
        {
          sha: "1a2b3c4",
          message: "Seed users",
          files: ["db/seed.sql"],
          at: pastIso(110),
          task: "Users table",
        },
      ],
    },
  ],
  leases: [
    {
      file: "api/users.ts",
      agent: "api",
      expires_at: futureIso(78),
      waiters: ["db"],
    },
    {
      file: "shared/auth.ts",
      agent: "api",
      expires_at: futureIso(64),
      waiters: ["web"],
    },
    {
      file: "web/login.tsx",
      agent: "web",
      expires_at: futureIso(85),
      waiters: [],
    },
  ],
  approvals: [
    {
      id: "ap1",
      agent: "db",
      tool: "Edit",
      target: "db/schema.sql",
      reason: "Sun Dome is guarded",
      expires_at: futureIso(48),
    },
  ],
};

export const FAKE_CHECKS: CheckEvent[] = [
  {
    agent: "db",
    tool: "Edit",
    file: "db/schema.sql",
    decision: "ask",
    rule: "db/**",
    latency_ms: 3,
    model: "rules",
    at: pastIso(12),
  },
  {
    agent: "web",
    tool: "Edit",
    file: "web/login.tsx",
    decision: "allow",
    rule: "default",
    latency_ms: 2,
    model: "rules",
    at: pastIso(35),
  },
  {
    agent: "api",
    tool: "Edit",
    file: "api/users.ts",
    decision: "allow",
    rule: "default",
    latency_ms: 2,
    model: "rules",
    at: pastIso(50),
  },
];

export const FAKE_HOOKS: Record<string, unknown>[] = [
  {
    agent: "api",
    event: "PostToolUse",
    tool_name: "Edit",
    tool_input: { file_path: "api/users.ts" },
    at: pastIso(18),
  },
  {
    agent: "api",
    event: "PreToolUse",
    tool_name: "Edit",
    tool_input: { file_path: "shared/auth.ts" },
    at: pastIso(32),
  },
  {
    agent: "web",
    event: "PostToolUse",
    tool_name: "Edit",
    tool_input: { file_path: "web/login.tsx" },
    at: pastIso(25),
  },
  {
    agent: "db",
    event: "PreToolUse",
    tool_name: "Edit",
    tool_input: { file_path: "db/schema.sql" },
    at: pastIso(12),
  },
];

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
    const approval = data.approvals.find((a) => a.id === action.id);
    const agent = approval?.agent;
    const allowed = action.decision === "allow";
    data = {
      ...data,
      worktrees: data.worktrees.map((w) =>
        w.agent === agent ? { ...w, status: allowed ? "working" : "blocked" } : w,
      ),
      approvals: data.approvals.filter((a) => a.id !== action.id),
      leases:
        allowed && approval
          ? [
              ...(data.leases ?? []),
              { file: approval.target, agent: approval.agent, expires_at: futureIso(90), waiters: [] },
            ]
          : (data.leases ?? []),
    };
    const check: Envelope = {
      type: "check",
      data: {
        agent: agent ?? "db",
        tool: approval?.tool ?? "Edit",
        file: approval?.target ?? "db/schema.sql",
        decision: allowed ? "allow" : "deny",
        rule: allowed ? "human-approved" : "db/**",
        latency_ms: 4,
        model: "rules",
        at: new Date().toISOString(),
      },
    };
    return [check, { type: "state", data }];
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
    leases: (data.leases ?? []).filter((l) => l.agent !== action.agent),
  };
  const first: Envelope =
    action.kind === "merge"
      ? { type: "merge", data: { agent: action.agent, sha, intent } }
      : { type: "undo", data: { agent: action.agent } };
  return [first, { type: "state", data }];
}

export function fakeOrchestrate(ask: string): Plan {
  const topic = ask.trim() || "Add role-based auth";
  return {
    ask: topic,
    source: "canned",
    started: true,
    tasks: [
      { agent: "api", task: `Edit shared/auth.ts to add token verification, then implement ${topic} routes in api/users.ts.` },
      { agent: "web", task: `Edit shared/auth.ts to export session types, then wire the UI in web/login.tsx.` },
      { agent: "db", task: `Update db/schema.sql with the role column and seed defaults in db/seed.sql.` },
    ],
  };
}

export function fakeAsk(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("db") || q.includes("sun dome") || q.includes("block")) {
    return "db is waiting on approval because the Jetson referee matched rule db/** on db/schema.sql (Sun Dome is guarded).";
  }
  if (q.includes("auth") || q.includes("wait") || q.includes("lease")) {
    return "api currently holds the lease on shared/auth.ts while web waits in the queue so neither agent overwrites the other.";
  }
  return "Three agents (api, web, db) are working in isolated git worktrees coordinated by Bullpen leases and Jetson policy rules.";
}

export function fakeDiff(agent: string, file: string): string {
  const target = file || "api/users.ts";
  if (target.startsWith("db/")) {
    return [
      `diff --git a/${target} b/${target}`,
      `--- a/${target}`,
      `+++ b/${target}`,
      `@@ -1,4 +1,6 @@`,
      ` CREATE TABLE users (`,
      `   id INTEGER PRIMARY KEY,`,
      `-  name TEXT NOT NULL`,
      `+  name TEXT NOT NULL,`,
      `+  role TEXT NOT NULL DEFAULT 'member'`,
      ` );`,
    ].join("\n");
  }
  if (target.startsWith("web/")) {
    return [
      `diff --git a/${target} b/${target}`,
      `--- a/${target}`,
      `+++ b/${target}`,
      `@@ -4,5 +4,8 @@ export function LoginForm() {`,
      `-  return <button>Sign in</button>;`,
      `+  const [role, setRole] = useState("member");`,
      `+  return (`,
      `+    <form data-agent="${agent}">`,
      `+      <button>Sign in ({role})</button>`,
      `+    </form>`,
      `+  );`,
    ].join("\n");
  }
  return [
    `diff --git a/${target} b/${target}`,
    `--- a/${target}`,
    `+++ b/${target}`,
    `@@ -10,6 +10,10 @@ export function handleRequest(req: Request) {`,
    `-  return { ok: true };`,
    `+  const session = verifySession(req.headers.get("authorization"));`,
    `+  if (!session) throw new AuthError("Unauthorized");`,
    `+  return { ok: true, user: session.user, agent: "${agent}" };`,
    ` }`,
  ].join("\n");
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
  const stamped: Commit = {
    ...commit,
    at: commit.at ?? new Date().toISOString(),
    task: commit.task ?? data.worktrees.find((w) => w.agent === agent)?.task,
  };
  data = withCommit(data, agent, stamped);
  return [
    {
      type: "hook",
      data: {
        agent,
        event: "PostToolUse",
        tool_name: "Edit",
        tool_input: { file_path: commit.files[0] ?? "" },
        at: stamped.at,
      },
    },
    { type: "commit", data: { agent, ...stamped } },
    { type: "state", data },
  ];
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
