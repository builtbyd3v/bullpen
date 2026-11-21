# Event contract

Source of truth for hook -> server -> Jetson -> web. Change it here first, tell the group chat, then change code.

## 1. Hook -> server
Body for both calls: the Claude Code hook JSON from stdin, unchanged, plus two fields:

| field | source |
|---|---|
| `agent` | env `BULLPEN_AGENT` (`"unknown"` if unset) |
| `event` | hook event name from argv: `PreToolUse`, `PostToolUse`, `Notification`, `Stop` |

Claude Code fields you can rely on: `session_id`, `cwd`, `hook_event_name`,
`tool_name` and `tool_input` (Pre/PostToolUse), `tool_response` (PostToolUse),
`message` (Notification).

| hook event | call | blocks the agent? |
|---|---|---|
| `PreToolUse` (Edit, Write, MultiEdit, Bash) | `POST {SERVER_URL}/checkout` | yes |
| `PostToolUse`, `Notification`, `Stop` | `POST {SERVER_URL}/hook` | never; the reply is ignored |

## 2. `POST /checkout` (the pre-edit call)
The file is `tool_input.file_path`, made relative to the repo root. Bash has no file: it gets the policy check but no lease.

Response:
```json
{"decision": "allow", "reason": "", "file": "api/users.py", "holder": "api", "expires_at": "2026-11-21T18:01:30Z"}
```
| decision | meaning | what the hook does |
|---|---|---|
| `allow` | policy passed and this agent holds the lease | allow |
| `wait` | another agent holds the lease (`holder`, `expires_at`), or another agent's unmerged branch already changed the file (`holder`, `expires_at: null`) | deny with the reason, so the agent works elsewhere and retries |
| `ask` | a human must approve and has not answered yet | deny with reason "approval pending" (see below) |
| `deny` | policy said no, a human said no, the approval timed out, or the agent's copy of the file is stale and its branch could not be updated from `main` automatically | deny with the reason |

Server steps, in order:
1. `POST {JETSON_URL}/check` (section 7) -> `allow` | `ask` | `deny`. Jetson down or bad reply -> `deny`, reason `"Bullpen policy offline"`.
2. `ask`: create an approval, broadcast `approval_needed`, and hold this HTTP request open until a human answers through `POST /approve/{id}` or 60 s pass. Timeout = `deny`. The server normally answers the hook with the final `allow` or `deny`; it returns a literal `ask` only if it cannot hold the request.
3. Merge guard, only when the lease is free or expired: another agent's branch changed the file and is not merged or undone (`git diff main...agent/<other> -- <file>`) -> `wait` with `holder` = that agent (`claim_wait`). `main` changed the file after this agent's branch started (`git diff agent/<agent>...main -- <file>`) -> the server first brings `main` into the agent's branch (`sync`) and checks again; only if that update is impossible (uncommitted changes or a conflict) -> `deny`. So no two branches change the same file before one is merged. `BULLPEN_BLOCK_UNMERGED=0` turns it off.
4. Lease `{file, agent, expires_at}`: free, expired, or held by this agent -> grant or renew for 90 s (`claim_granted`). Held by another agent -> `wait` (`claim_wait`).

Leases: TTL 90 s. Renewed by each `/checkout` and each `PostToolUse` from the holder for that file. Released on commit, on `Stop`, on undo, and on expiry (`claim_released`). The Jetson holds no lease state. The demo runs the server with `BULLPEN_RELEASE_ON_COMMIT=0`: a lease is then kept past its commit and released only on `Stop`, undo or expiry, so a second agent visibly waits.

The hook's HTTP timeout for `/checkout` is 70 s, because an approval can take 60 s.

## 3. Hook -> Claude Code (PreToolUse only), stdout
```json
{"hookSpecificOutput": {"hookEventName": "PreToolUse",
  "permissionDecision": "deny", "permissionDecisionReason": "..."}}
```
Fail closed: server unreachable, timeout, or bad reply on PreToolUse -> deny,
reason `"Bullpen referee offline"`. Other events never block.

`POST /hook` side effects on the server: `PostToolUse` of an edit -> auto-commit that file in the agent's worktree, with the message from Jetson `/commit_msg` (fallback `Edit <file>`) and the trailers `Bullpen-Agent: <agent>` and `Bullpen-Task: <task>`; then release the lease and broadcast `commit` and `state`. `Stop` -> release all of that agent's leases.

## 4. Server -> web: `WS {SERVER_URL}/ws`
Every message is an envelope: `{"type": <type>, "data": <object>}`.

| type | data | when |
|---|---|---|
| `hook` | the body from section 1 | every `/checkout` and `/hook` call |
| `state` | the full `/state` payload (section 5) | after every lease change, commit, undo, merge, approval |
| `claim_granted` | `{agent, file, building, expires_at}` | a lease is granted or renewed |
| `claim_wait` | `{agent, file, building, holder}` | an agent is told to wait |
| `claim_released` | `{agent, file, building, text}` | `text` is `"commit"`, `"stop"`, `"undo"` or `"expired"` |
| `approval_needed` | `{id, agent, tool, target, reason, expires_at}` | policy said `ask` |
| `approved` | `{id, agent}` | a human approved |
| `denied` | `{id, agent, text}` | `text` is `"human"` or `"timeout"` |
| `check` | `{agent, tool, file, decision, rule, latency_ms, model, at}` | after every Jetson `/check`. `decision` is `allow`, `ask` or `deny`. Jetson unreachable: `decision: "deny"`, `rule: "offline"`, `model: ""`. `latency_ms` is measured by the server. Feeds the referee log |
| `commit` | `{agent, sha, message, files, task}` | the server auto-commits an edit |
| `undo` | `{agent}` | after `POST /undo/{agent}` |
| `plan` | `{ask, tasks: [{agent, task}]}` | the server got a `Plan` event on `/hook` from the orchestrator |
| `secret_blocked` | `{agent, file, kind}` | the secret guard stopped a diff |
| `merge` | `{agent, sha, intent}` | after `POST /merge/{agent}`; `intent` is the Jetson `/summarize` text, or `""` |
| `sync` | `{agent, sha, text}` | the server brought `main` into that agent's branch; `text` is `"merge <agent>"` (right after a merge) or `"stale"` (at a checkout) |

Clients must ignore types they do not know. Server TODO: `server/main.py` still sends bare hook bodies.

## 5. `GET /state`
```json
{
  "main": "main",
  "worktrees": [{
    "agent": "api", "color": "#e5484d", "branch": "agent/api",
    "path": "/abs/path/demo-api", "task": "Add /users endpoint",
    "changed_files": ["api/users.py"],
    "ahead": 2,
    "claims": ["enb"],
    "status": "working",
    "building": "enb",
    "commits": [{"sha": "a1b2c3d", "message": "Add users route", "files": ["api/users.py"]}]
  }],
  "approvals": [{"id": "ap1", "agent": "db", "tool": "Edit", "target": "db/schema.sql", "reason": "Sun Dome is guarded"}]
}
```
- `changed_files`: `git diff --name-only main...<branch>`. `ahead`: `git rev-list --count main..<branch>`.
- `claims`: building ids from `campus/campus.json`. `building`: where the agent is now.
- `status`: `working` | `waiting` | `blocked` | `done`. `commits`: `main..<branch>`, newest first; `message` is the reason.
- Colors: api `#e5484d`, web `#3e63dd`, db `#f5b400`.
- Evidence panel fields, all additive: top-level `leases: [{file, agent, expires_at, waiters: [agent]}]` (`waiters` is the wait queue, oldest first); `at` (ISO time) and `task` on each commit; `expires_at` on each approval. `claims` stays the list of building ids that hold at least one lease of that agent.

## 6. Actions (web -> server)
The server must send CORS headers (allow all origins): the web app runs on another port.
- `POST /undo/{agent}`: `git reset --hard main` in that worktree, release its claims, broadcast `undo` then `state`. In that `state`, the agent's `building` is `"bullrunner"` (the Bull walks to the hub).
- `POST /merge/{agent}`: merge the branch into main, broadcast `merge`, bring `main` into every agent branch whose worktree has no uncommitted changes (`sync` for each one that changed; a fast-forward when the branch has no commits of its own, otherwise a merge commit `Sync main into agent/<name>`), then `state`. In that `state`, the agent's `building` is `"bullrunner"` and `status` is `"done"`. The reply adds `synced: [agent]`.
- `POST /approve/{id}` body `{"decision": "allow" | "deny"}`: resolve a pending approval, answer the held `/checkout`, broadcast `approved` or `denied`, then `state`. No answer in 60 s = `denied` with text `"timeout"`.
- `GET /diff?agent=<agent>&file=<path>` -> `{"diff": str}`: `git diff main...<branch> -- <path>`. `file` may be a folder (for example `api/`). Feeds the building click.
- `GET /history?file=<path>`: commits that touched the file, newest first: `[{sha, agent, task, message, at}]`.
- `GET /replay`: re-broadcast `events.log` in order. Every replayed envelope carries `"replay": true` so the web can label it.

## 6b. Orchestrator: `{ORCHESTRATOR_URL}` (port 8650)
`NEXT_PUBLIC_ORCHESTRATOR_URL=http://localhost:8650`. FastAPI, CORS allows all origins. Runs on Dev's Mac next to the worktrees.
Env: `SERVER_URL` (default `http://localhost:8600`), `JETSON_URL` (default `http://192.168.55.1:8700`), `DEMO_START_CMD` (default `<repo>/scripts/demo_start.sh`), `CLAUDE_BIN` (default `claude`), `DEMO_DIR` (default `<parent of repo>/demo`, as in `make_demo.sh`).
- `GET /health` -> `{"ok": true}`.
- `POST /orchestrate` body `{"ask": str}` -> 200 `{"ask": str, "tasks": [{"agent": "api" | "web" | "db", "task": str}], "source": "claude" | "canned", "started": true}`. Empty or missing `ask` -> 422.
  1. The `claude` CLI runs headless on the user's subscription (no API key) and splits the ask into exactly 3 tasks, one each for `api`, `web`, `db`. The planner gets `git -C $DEMO_DIR ls-files` (first 200 lines; none if git fails) and must name real files: api and web both edit the same `shared/` file first, db edits the schema under `db/`. The orchestrator validates the plan strictly.
  2. CLI failure, timeout (45 s) or an invalid plan -> the canned tasks in `scripts/demo_tasks.json` (tasks file shape below), `source: "canned"`. That file missing or invalid too -> 502 `{"error": str}`.
  3. It writes a tasks file and runs `DEMO_START_CMD <tasks file>`. Non-zero exit -> 502 `{"error": str}`.
  4. `POST {SERVER_URL}/hook` body `{"event": "Plan", "agent": "orchestrator", "ask": str, "tasks": [{agent, task}]}`. The server broadcasts `plan` (section 4). A server failure here does not fail the request: the response adds `"plan_posted": false`.
- `POST /ask` body `{"question": str}` -> `{"answer": str}`. Context is plain text, newest last, max 8000 chars: recent events from the server's events log (env `BULLPEN_EVENTS_LOG`, default `<repo>/server/events.log`; `state` and `hook` skipped; missing log -> none) plus a summary of `GET {SERVER_URL}/state` (server down -> none). Then it calls Jetson `POST /ask` `{question, context}` (section 7) and returns its `answer`. Jetson down, timeout (25 s) or bad reply -> 503 `{"error": str}`. No Claude usage on this path.
- Tasks file (JSON): `{"ask": str, "tasks": [{"agent": "api", "task": str}, {"agent": "web", "task": str}, {"agent": "db", "task": str}]}`.
- `scripts/demo_start.sh [tasks file]` (default `scripts/demo_tasks.json`) starts one headless agent per task in `demo-<agent>` with `BULLPEN_AGENT=<agent>`, logs to `$BULLPEN_LOG_DIR/<agent>.log` (default `/tmp/bullpen`), pid in `<agent>.pid`, and returns right away. Each agent gets fixed referee ground rules through `--append-system-prompt` (on deny or wait: do other files first, retry once at the end; on a guarded `db/` ask or deny: write `docs/<agent>-plan.md` and stop; read with Read, Grep and Glob, never Bash; no git commands; first edit within 3 tool calls, read only the file about to be edited; edit only the files the task names plus `docs/<agent>-plan.md`). Every agent runs `--model $BULLPEN_AGENT_MODEL` (default `sonnet`), so the task text stays clean.

## Campus layout: `campus/campus.json` (generated file, no endpoint)
`python3 scripts/make_campus.py <repo path>` writes it. The web imports the file; the server reads the same file. Deterministic: the same repo gives the same layout.

Rules:
1. Count tracked files per top-level folder (`git ls-files`). Sort by count, highest first; ties by name.
2. Guarded folders (default `db/`) take the `sundome` slot and get `guarded: true`.
3. The other top folders fill the fixed slots in this order, up to 8 buildings in total: `msc`, `library`, `enb`, `enc`, `muma`, `cooper`, `rec`.
4. Every other folder maps to the Annex (`juniper`, `folder: null`). Files in the repo root map to the hub (`bullrunner`, `folder: ""`).
5. Slot positions (`x`, `y`, `w`, `h`) and names are fixed per slot. Only `folder` and `rooms` change.

Shape:
```json
{
  "repo": "demo", "width": 960, "height": 640,
  "buildings": [{
    "id": "enb", "name": "ENB", "folder": "api/", "guarded": false,
    "x": 660, "y": 60, "w": 180, "h": 110,
    "files": 42,
    "rooms": [{"name": "routes", "path": "api/routes/", "files": 12}]
  }]
}
```
- `rooms`: up to 6 per building, for the interior view: its subfolders by file count, then its largest files if there are fewer than 6 subfolders. `path` ends in `/` for a folder.
- File -> building: longest non-empty `folder` prefix; root files -> `bullrunner`; no match -> `juniper`.
- Interior view data, all existing: an agent's current file is its lease in `/state` `leases`; the sign is its `branch`; the mini log is that agent's `hook` events; the diff is `GET /diff`.

## 7. Jetson: `{JETSON_URL}` (port 8700), policy and local model only
`JETSON_URL=http://192.168.55.1:8700` (USB). Fallback `http://dev.local:8700`. No lease state lives here.
- `POST /check` body `{"agent": str, "tool_name": str, "file": str?, "command": str?}` -> `{"decision": "allow" | "ask" | "deny", "reason": str, "rule": str, "model": str}`. `model` is `"rules"` when no model ran. Rules run first, with no model call: `db/**` = `ask`. `rule` names the rule that matched, or `"default"`.
- `POST /commit_msg` body `{"diff": str, "agent": str?}` -> `{"message": str}`. One imperative line, max 72 chars.
- `POST /summarize` body `{"agent": str, "branch": str, "diff": str, "commits": [str]}` -> `{"intent": str}`. One or two sentences on what the branch set out to do.
- `POST /ask` body `{"question": str, "context": str?}` -> `{"answer": str}`. Max 2 sentences. `context` is free text (state, recent events).
- `POST /scan` body `{"diff": str}` -> `{"ok": bool, "findings": [{"file": str, "line": int, "kind": str}]}`. Secret guard: regex rules for API keys, tokens, private keys and `.env` values, no model call. The server calls it before the auto-commit; `ok: false` means no commit, broadcast `secret_blocked`, and tell the agent on its next `/checkout` (deny with the reason).
- Models: `/check` and `/scan` use rules only; `/commit_msg` qwen2.5-coder:3b; `/summarize` llama3.2:3b; `/ask` nomic-embed-text + llama3.2:3b.
- `POST /reset` -> `{"ok": true}`. Clears any per-demo memory and pre-warms the model.
- Model failure or timeout (20 s) -> `503 {"error": str}`. `/check` failure means deny at the server. For the others, callers fall back (for example to a plain commit message).
