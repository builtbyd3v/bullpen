# Event contract

One event shape flows hook -> server -> web. Change it here first, then in code.

## 1. Hook -> server: `POST {SERVER_URL}/hook`
Body: the Claude Code hook JSON from stdin, unchanged, plus two fields:

| field | source |
|---|---|
| `agent` | env `BULLPEN_AGENT` (`"unknown"` if unset) |
| `event` | hook event name from argv: `PreToolUse`, `PostToolUse`, `Notification`, `Stop` |

Claude Code fields you can rely on: `session_id`, `cwd`, `hook_event_name`,
`tool_name` and `tool_input` (Pre/PostToolUse), `tool_response` (PostToolUse),
`message` (Notification).

## 2. Server -> hook: response
```json
{"decision": "allow", "reason": ""}
```
`decision` is `"allow"` or `"deny"`. `reason` is shown to the agent on deny.

## 3. Hook -> Claude Code (PreToolUse only), stdout
```json
{"hookSpecificOutput": {"hookEventName": "PreToolUse",
  "permissionDecision": "deny", "permissionDecisionReason": "..."}}
```
Fail closed: server unreachable or bad reply on PreToolUse -> deny,
reason `"Bullpen referee offline"`. Other events never block.

## 4. Server -> web: `WS {SERVER_URL}/ws`
Every message is an envelope: `{"type": <type>, "data": <object>}`.

| type | data | when |
|---|---|---|
| `hook` | the body from section 1 | every hook call |
| `state` | the full `/state` payload (section 5) | after every commit, undo, merge, approval |
| `commit` | `{agent, sha, message, files}` | an agent commits on its branch |
| `undo` | `{agent}` | after `POST /undo/{agent}` |
| `merge` | `{agent, sha}` | after `POST /merge/{agent}` |

Server TODO (Monisha): `server/main.py` still sends bare hook bodies. Wrap them as `{"type": "hook", "data": ...}`.

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

## 6. Actions (web -> server)
- `POST /undo/{agent}`: `git reset --hard main` in that worktree, release its claims, broadcast `undo` then `state`. In that `state`, the agent's `building` is `"bullrunner"` (the Bull walks to the hub).
- `POST /merge/{agent}`: merge the branch into main, broadcast `merge` then `state`. In that `state`, the agent's `building` is `"bullrunner"` and `status` is `"done"`.
- `POST /approve/{id}` body `{"decision": "allow" | "deny"}`: resolve a pending approval, broadcast `state`.

## Folder -> building
`campus/campus.json` maps repo folders to campus buildings. `folder: null`
(Juniper-Poplar) catches unmapped paths. `folder: ""` (Bull Runner) is the repo
root: files with no folder map there. Unknown folders map to Juniper. `guarded: true` (Sun Dome, `db/`) marks folders the referee protects.

## 7. Jetson: `{JETSON_URL}` (port 8700)
- `POST /commit_msg` body `{"diff": str, "agent": str?}` -> `{"message": str}`. One imperative line, max 72 chars.
- `POST /ask` body `{"question": str, "context": str?}` -> `{"answer": str}`. Max 2 sentences. `context` is free text (state, recent events).
- Model failure or timeout (20 s) -> `503 {"error": str}`. Callers fall back (for example to a plain commit message).
