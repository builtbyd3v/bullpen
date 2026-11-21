# server (owner: Monisha)

Referee and event hub. FastAPI on port 8600, runs on the Mac next to the demo worktrees.
Contract: `../shared/events.md` (sections 2 to 6). The server calls no model: it only calls the Jetson.

- Overview, without vs. with Bullpen: [docs/version-control-overview.png](docs/version-control-overview.png)
- How an edit flows through the referee: [docs/version-control-flow.png](docs/version-control-flow.png)

```sh
cd server
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 8600
```

| Env | Default | What |
|---|---|---|
| `BULLPEN_REPO` | `../../demo` (what `scripts/make_demo.sh` creates) | The demo repo's main checkout. Agent worktrees are found with `git worktree list`: branch `agent/<name>` = agent `<name>` |
| `JETSON_URL` | `http://192.168.55.1:8700` | Policy and local models. Down = every edit denied (fail closed) |
| `BULLPEN_MAIN` | `main` | The branch agents merge into |
| `BULLPEN_CAMPUS` | `../campus/campus.json` | Folder -> building map |
| `BULLPEN_EVENTS_LOG` | `server/events.log` | Every envelope, for `GET /replay` |

## Files
- `main.py`: routes, the `/checkout` flow, auto-commit, undo, merge, the WebSocket hub.
- `referee.py`: in-memory leases, wait queues, approvals, agent status, file -> building.
- `gitops.py`: git calls (worktrees, log with trailers, commit, reset, merge, diff).
- `jetson.py`: Jetson client (`/check`, `/scan`, `/commit_msg`, `/summarize`), standard library only.
- `config.py`: settings above, plus `LEASE_TTL`, `APPROVAL_TIMEOUT`, `RELEASE_ON_COMMIT`.

## Endpoints
- `GET /health` -> `{"ok": true, "repo", "repo_found", "jetson"}`
- `POST /checkout` -> `allow | wait | deny` with `reason`, `file`, `holder`, `expires_at`. Runs Jetson `/check`, holds the request up to 60 s for a human on `ask`, then claims the file lease (TTL 90 s).
- `POST /hook` -> `PostToolUse` of an edit queues an auto-commit (secret scan, Jetson commit message, `Bullpen-Agent` and `Bullpen-Task` trailers, author `agent <name>`), then releases the lease. `Stop` releases the agent's leases. `Plan` (from the orchestrator) sets each agent's task. `PreToolUse` is answered like `/checkout`, mapped to allow or deny, until the hook moves to `/checkout`.
- `GET /state`, `WS /ws` (`{type, data}` envelopes), `GET /diff?agent=&file=`, `GET /history?file=`, `GET /replay`
- `POST /undo/{agent}` (`git reset --hard main` in its worktree), `POST /merge/{agent}` (`--no-ff` merge with the Jetson `/summarize` intent; a conflict aborts and returns 409), `POST /approve/{id}` body `{"decision": "allow" | "deny", "reason"?: str}`. An optional `reason` on deny is passed to the agent ("add a migration instead").

Behaviour worth knowing:
- One git write lock per worktree, so commits never collide on `index.lock`. The hook gets its reply at once; commits run in the background.
- A human "allow" holds for that agent and file until the agent is undone, so its retries go straight through.
- Jetson `/scan` or `/commit_msg` down: the commit still happens, with the message `Edit <file>`. Only `/check` fails closed.

## Tests

```sh
cd server
uv run python -m unittest discover tests      # or: python -m unittest discover tests
```

About 1.5 minutes, no Jetson, Mac or agents needed. Each test class builds a throwaway demo repo with agent worktrees, starts a fake Jetson (`db/` = ask, its endpoints can be switched to down or bad replies) and the real server on a free port.

- `tests/test_unit.py` (fast, no server): lease grant, renew, wait queue order, expiry and release; approvals; agent status; file -> building (longest prefix, root, annex, campus reload); path normalization (`..`, outside the worktree, sibling folders); git log and trailer parsing.
- `tests/test_api.py` (real server): leases across worktrees, expiry with a short TTL, `BULLPEN_RELEASE_ON_COMMIT=0`, fail-closed policy (Jetson down, bad reply, unreachable), approvals (approve, deny with note, timeout, shared retries, lease still applies, undo forgets), auto-commit (trailers, fallbacks, secret guard, deletes, spaces, unicode, parallel edits), undo, merge (conflict aborts cleanly), reads, malformed input, and a missing demo repo.

Test-only env vars: `BULLPEN_LEASE_TTL`, `BULLPEN_APPROVAL_TIMEOUT` (seconds), `BULLPEN_RELEASE_ON_COMMIT` (`0` keeps a lease until Stop, undo or expiry). Defaults match the contract.

Smoke test: `curl -X POST localhost:8600/checkout -H 'Content-Type: application/json' -d '{"agent":"api","tool_name":"Edit","cwd":"/path/to/demo-api","tool_input":{"file_path":"/path/to/demo-api/api/users.py"}}'`
