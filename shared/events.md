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
Each message is one JSON event, exactly the body from section 1.

## Folder -> building
`campus/campus.json` maps repo folders to campus buildings. `folder: null`
(Juniper-Poplar) catches unmapped paths. `folder: ""` (Bull Runner) is the repo
root. `guarded: true` (Sun Dome, `db/`) marks folders the referee protects.
