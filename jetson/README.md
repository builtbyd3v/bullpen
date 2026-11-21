# jetson (owner: Dev)

Local model service on the Jetson. FastAPI on port 8700. Model: `lfm3:1.7b-q4_K_M` through Ollama `/api/chat`.

Deploy and restart (from the repo root on the Mac, over USB):

```sh
rsync -av --exclude .venv --exclude __pycache__ ./jetson/ dev@192.168.55.1:~/app/
ssh dev@192.168.55.1 'pkill -f "[u]vicorn main:app"; sleep 1; ss -ltn | grep ":8700 "'   # expect no output
ssh dev@192.168.55.1 'cd ~/app; setsid nohup uv run --project ~/hackkit uvicorn main:app --host 0.0.0.0 --port 8700 > ~/app/server.log 2>&1 < /dev/null &'
curl http://192.168.55.1:8700/health
```

- Runs in the `~/hackkit` env, so no `uv sync` on the Jetson. Log: `~/app/server.log`.
- Use `cd ~/app;`, not `cd ~/app &&`: with `&&` the backgrounded list keeps the ssh session open.
- Env: `OLLAMA_URL` (default `http://localhost:11434`), `JETSON_MODEL` (default `lfm3:1.7b-q4_K_M`).

Endpoints:
- `GET /health` -> `{"ok": true}`
- `POST /check` -> `{"decision": "allow"}`
- `POST /commit_msg` `{"diff", "agent"?}` -> `{"message"}`: one line, max 72 chars. Diff is cut to 12,000 chars.
- `POST /ask` `{"question", "context"?}` -> `{"answer"}`: max 2 sentences. Context keeps its last 12,000 chars.
- Model failure or timeout (20 s) -> 503 `{"error"}`.
- Latency (measured): about 1.7 s warm for a 3.5 KB diff, 4.4 s cold, `/ask` about 1.7 s.
- TODO: `/claim`, `/release`, `voice.py`
