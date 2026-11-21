# server (owner: Monisha)

Referee and event hub. FastAPI on port 8600. Contract: `../shared/events.md`.

```sh
cd server
uv sync
uv run uvicorn main:app --port 8600 --reload
```
Add `--host 0.0.0.0` so teammates on the hotspot can reach it.

- `GET /health` -> `{"ok": true}`
- `POST /hook` -> stores the event, broadcasts it on `/ws`, replies allow
- `GET /state` -> last 200 events
- `WS /ws` -> one JSON message per event

Smoke test: `curl -X POST localhost:8600/hook -H 'Content-Type: application/json' -d '{"agent":"api","event":"PreToolUse"}'`
