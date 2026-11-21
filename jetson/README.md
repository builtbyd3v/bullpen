# jetson (owner: Dev)

Referee and local model service on the Jetson. FastAPI on port 8700. Rules for `/check` and `/scan`; local models through Ollama for the rest.

Deploy and restart (from the repo root on the Mac, over USB):

```sh
rsync -av --exclude .venv --exclude __pycache__ ./jetson/ dev@192.168.55.1:~/app/
ssh dev@192.168.55.1 'pkill -f "[u]vicorn main:app"; sleep 1; ss -ltn | grep ":8700 "'   # expect no output
ssh dev@192.168.55.1 'cd ~/app; setsid nohup uv run --project ~/hackkit uvicorn main:app --host 0.0.0.0 --port 8700 > ~/app/server.log 2>&1 < /dev/null &'
curl http://192.168.55.1:8700/health
```

- Runs in the `~/hackkit` env, so no `uv sync` on the Jetson. Log: `~/app/server.log`.
- Use `cd ~/app;`, not `cd ~/app &&`: with `&&` the backgrounded list keeps the ssh session open.
- Pre-warms every model on startup in a background thread. Startup does not wait for it or fail without Ollama.
- Requests send no `keep_alive`, so Ollama's own setting applies (forever on the Jetson).

Env:
- `OLLAMA_URL` (default `http://localhost:11434`)
- `BULLPEN_GUARDED` (default `db`): comma list of guarded folders for `/check`
- `NUM_CTX` (default `4096`): context size for every chat call and the warm call. Keep it the same in both, or Ollama reloads the model.
- `COMMIT_MODEL` (default `qwen2.5-coder:3b`), `SUMMARIZE_MODEL` (default `llama3.2:3b`), `ASK_MODEL` (default `llama3.2:3b`), `EMBED_MODEL` (default `nomic-embed-text`)

Endpoints:
- `GET /health` -> `{"ok": true}`
- `POST /check` `{"agent", "tool_name", "file"?, "command"?}` -> `{"decision", "reason", "rule", "model"}`. Rules only, `model` is `"rules"`. A `file` under a guarded folder (relative, `./`, or absolute with `/db/`) or a Bash `command` that names a guarded path -> `ask`, rule `db/**`. Never `deny`: the deny comes from the server approval timeout. Else `allow`, rule `default`. Bad body -> 422.
- `POST /scan` `{"diff"}` -> `{"ok", "findings": [{"file", "line", "kind"}]}`. Regex only, added lines only, `line` is the new-file line. Kinds: `aws_access_key`, `github_token`, `anthropic_key`, `openai_key`, `slack_token`, `private_key`, `env_value` (secret-named `NAME=value` in a `.env*` file), `generic_secret` (a quoted literal of 16+ chars that mixes letters and digits, with no `/` or `:`, assigned to a secret/token/password/api_key name). Placeholders, empty values and env reads are skipped. The secret value is never returned.
- `POST /commit_msg` `{"diff", "agent"?}` -> `{"message"}`: one line, max 72 chars. Diff is cut to 8,000 chars. Model: `COMMIT_MODEL`.
- `POST /summarize` `{"agent", "branch", "diff", "commits"}` -> `{"intent"}`: max 2 sentences on what the branch set out to do. Model: `SUMMARIZE_MODEL`.
- `POST /ask` `{"question", "context"?}` -> `{"answer"}`: max 2 sentences. Context over 3,000 chars is ranked line by line by `EMBED_MODEL` similarity to the question; on an embed failure it keeps the last 8,000 chars. Model: `ASK_MODEL`.
- `POST /reset` -> `{"ok": true, "warmed": [models]}`. Pre-warms each model (120 s timeout per warm call; real calls keep 20 s). A warm failure still returns `ok: true`.
- Model failure or timeout (20 s) -> 503 `{"error"}`.
- Tests: `uv run --with pytest pytest -q` (Ollama is mocked).
- Bash rule: a command that names a guarded path (`db/x`, `./db/x`, `cd db`, absolute paths; not a ref like `agent/db`) returns `ask` unless it is provably read-only. Read-only means:
  - no `>`, `>>`, `tee`, `$(...)` or backticks; `2>&1` and `2>/dev/null` are fine
  - every part split on `;`, `&&`, `||`, `|`, `&` and newlines starts with `cat`, `ls`, `head`, `tail`, `grep`, `rg`, `wc`, `pwd`, `cd`, `echo`, `stat`, `file`, `tree`, `sort`, `uniq`, `cut`, `diff`, `which`, `true`, `test`, `find`, or `git log|diff|status|show|ls-files|branch|rev-parse|blame`
  - no write flags: `find -delete/-exec/-ok/-fprint/-fls`, `sort -o`, `tree -o`, `rg --pre`, `git --output`, `uniq IN OUT`, `git branch` with anything but list flags

  Anything else (`sed`, `python`, `cp`, `rm`, `sqlite3`, `npm`, `env`, `FOO=1 cmd`, unknown commands) stays `ask`.

Memory and latency (measured on the Jetson, `NUM_CTX` 4096):
- All three models stay loaded together: qwen2.5-coder:3b 2.2 GB, llama3.2:3b 2.6 GB, nomic-embed-text 414 MB. At 8192 they do not fit, and each switch reloads a model.
- A warm switch between models costs 0.2 s. A cold qwen2.5-coder:3b load takes 66 s. `/ask` took 13 s when it had to load the model. `/reset` took 54 s cold.
- Free memory is tight: about 180 MB with all three loaded. If memory runs out, point `COMMIT_MODEL`, `SUMMARIZE_MODEL` and `ASK_MODEL` at one model.
