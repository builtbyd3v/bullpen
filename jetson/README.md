# jetson (owner: Dev)

Local model service on the Jetson. FastAPI on port 8700.

```sh
rsync -av --exclude .venv ./jetson/ dev@dev.local:~/app/
ssh dev@dev.local 'cd ~/app && uv sync && uv run uvicorn main:app --host 0.0.0.0 --port 8700'
```

- `GET /health` -> `{"ok": true}`
- `POST /check` -> `{"decision": "allow"}`
- TODO: `/claim`, `/release`, `/commit_msg`, `/ask`, `voice.py`
