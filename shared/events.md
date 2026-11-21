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
| `wait` | another agent holds the lease (`holder`, `expires_at`) | deny with the reason, so the agent works elsewhere and retries |
| `ask` | a human must approve and has not answered yet | deny with reason "approval pending" (see below) |
| `deny` | policy said no, a human said no, or the approval timed out | deny with the reason |

Server steps, in order:
1. `POST {JETSON_URL}/check` (section 7) -> `allow` | `ask` | `deny`. Jetson down or bad reply -> `deny`, reason `"Bullpen policy offline"`.
2. `ask`: create an approval, broadcast `approval_needed`, and hold this HTTP request open until a human answers through `POST /approve/{id}` or 60 s pass. Timeout = `deny`. The server normally answers the hook with the final `allow` or `deny`; it returns a literal `ask` only if it cannot hold the request.
3. Lease `{file, agent, expires_at}`: free, expired, or held by this agent -> grant or renew for 90 s (`claim_granted`). Held by another agent -> `wait` (`claim_wait`).

Leases: TTL 90 s. Renewed by each `/checkout` and each `PostToolUse` from the holder for that file. Released on commit, on `Stop`, on undo, and on expiry (`claim_released`). The Jetson holds no lease state.

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
- `POST /merge/{agent}`: merge the branch into main, broadcast `merge` then `state`. In that `state`, the agent's `building` is `"bullrunner"` and `status` is `"done"`.
- `POST /approve/{id}` body `{"decision": "allow" | "deny"}`: resolve a pending approval, answer the held `/checkout`, broadcast `approved` or `denied`, then `state`. No answer in 60 s = `denied` with text `"timeout"`.
- `GET /diff?agent=<agent>&file=<path>` -> `{"diff": str}`: `git diff main...<branch> -- <path>`. `file` may be a folder (for example `api/`). Feeds the building click.
- `GET /history?file=<path>`: commits that touched the file, newest first: `[{sha, agent, task, message, at}]`.
- `GET /replay`: re-broadcast `events.log` in order. Every replayed envelope carries `"replay": true` so the web can label it.

## Folder -> building
`campus/campus.json` maps repo folders to campus buildings. `folder: null`
(Juniper-Poplar) catches unmapped paths. `folder: ""` (Bull Runner) is the repo
root: files with no folder map there. Unknown folders map to Juniper. `guarded: true` (Sun Dome, `db/`) marks folders the referee protects.

## 6b. Orchestrator: `http://localhost:8650` (Dev)
Runs Claude Code through the `claude` CLI on the user's subscription. No API key.
- `POST /orchestrate` body `{"ask": str}` -> `{"tasks": [{"agent": "api" | "web" | "db", "task": str}]}`. Splits the ask into one task per agent, starts the agents (`scripts/demo_start.sh`), then posts `{"event": "Plan", "agent": "orchestrator", "ask": str, "tasks": [...]}` to the server's `POST /hook`. The server stores each task as that worktree's `task` in `/state` and broadcasts `plan`.
- `POST /ask` body `{"question": str, "agent": str?}` -> `{"answer": str}`. Ask-why: reads the server's `/state` and `/history`, then calls Jetson `/ask`. Jetson down -> `503 {"error": str}`.
- Sends CORS headers, like the server.

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
