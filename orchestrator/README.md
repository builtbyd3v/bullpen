# Bullpen orchestrator

One ask in, three agents out. Contract: `shared/events.md` section 6b.

- `POST /orchestrate` `{"ask"}`: the `claude` CLI (your subscription, no API key) splits the ask into one task each for api, web and db. CLI failure, 45 s timeout or a bad plan falls back to `scripts/demo_tasks.json` (`source: "canned"`). Then `scripts/demo_start.sh` starts the agents and the `Plan` event goes to the server.
- `POST /ask` `{"question"}`: ask-why. Server `/state` is the context, the Jetson answers. No Claude usage.

## Run
```
cd orchestrator
uv run uvicorn main:app --port 8650
```
Env: `SERVER_URL` (http://localhost:8600), `JETSON_URL` (http://192.168.55.1:8700), `DEMO_START_CMD` (`<repo>/scripts/demo_start.sh`), `CLAUDE_BIN` (`claude`).

Agents need the worktrees from `scripts/make_demo.sh`. Agent logs and pids: `/tmp/bullpen/<agent>.log` and `.pid` (`BULLPEN_LOG_DIR`).

## Test
```
cd orchestrator
uv run --with pytest pytest -q
```
The tests fake the CLI, the start script, the server and the Jetson. Nothing real starts.
