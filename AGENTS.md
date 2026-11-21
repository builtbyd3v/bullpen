Keep CLAUDE.md and AGENTS.md identical.

# Bullpen

Git was built for humans. Bullpen is version control for agents. Several Claude Code agents work in parallel, each in its own git worktree and branch. A hook asks a referee before every edit. The referee leases files so two agents never edit the same one, asks a human before guarded edits, commits every edit, and lets the human merge or undo a whole branch. The web app shows it live as the USF campus: each folder is a building, `main` is the campus, each agent's branch is a colored layer.

HackJam '26, USF Tampa, Sat Nov 21, 2026. Hacking 11:00 AM to 6:00 PM ET, submission closes 6:00 PM sharp. Judging: about 3 min showcase plus 1 min Q&A at the table.

Mode: hackathon

## Rules
- Only edit your own folder (table below). Need a change elsewhere? Ask the owner.
- Contract changes go through `shared/events.md` first, plus a heads-up in the group chat.
- Pull `main` before you start. Small PRs to `main`. `main` is protected: CI (`ci-ok`) must pass.
- No code from before 11:00 AM on Nov 21. Everything is built fresh in this repo.
- Credit all AI use (models and tools) and list every framework in the README and the MLH submission. Missing credit means disqualification.
- No reskin of an existing AI tool. Do not name mascots or UI after AI models or products.
- Scope: 3 core features end to end (referee, live layers, merge and undo). MVP freeze 3:30 PM, stop coding 5:00 PM.
- One prize per team. We enter Best Overall. Weights: Technical 25, Innovation 20, Track relevance 20, Execution 20, Presentation 15.

## Ownership

| Folder | Owner | GitHub |
|---|---|---|
| `hooks/`, `jetson/`, `scripts/`, `demo-seed/` | Dev | builtbyd3v |
| `server/` | Monisha | Monisha-Repos |
| `web/`, `design/` | Caua | caua-fm234 |
| `shared/`, `campus/`, `CLAUDE.md`, `AGENTS.md` | shared: change through the contract rule | |

## Ports and URLs

| Service | Port | URL |
|---|---|---|
| web (Next.js 16 + Phaser 3) | 5173 | http://localhost:5173 (`?fake` runs without a server) |
| server (FastAPI) | 8600 | `SERVER_URL=http://localhost:8600`; the web reads `NEXT_PUBLIC_SERVER_URL` from `web/.env.local` |
| Jetson (FastAPI + Ollama) | 8700 | `JETSON_URL=http://192.168.55.1:8700` (USB cable). Fallback: `http://dev.local:8700` |

## The flow
```
agent wants to edit a file
  -> hook (PreToolUse)  POST server /checkout
       -> server        POST Jetson /check   -> allow | ask | deny   (rules first; db/** = ask)
       -> server applies the lease {file, agent, expires_at}
            free or held by this agent -> allow (TTL 90 s, renewed by the holder)
            held by another agent      -> wait
            ask -> approval shown in the web; no answer in 60 s = deny
  <- answer to the hook: allow | wait | ask | deny, with a reason
agent edits -> hook (PostToolUse) POST server /hook -> server auto-commits the edit
               (trailers Bullpen-Agent, Bullpen-Task) and broadcasts commit + state
agent stops -> hook (Stop) POST server /hook -> server releases that agent's leases
```
- The Jetson is policy only. It holds no lease state.
- Fail closed: server down, Jetson down, or a bad reply means deny.
- Leases are released on commit, on Stop, and when they expire.

## Contract
`shared/events.md` is the source of truth for every request, response and WebSocket event. `campus/campus.json` maps folders to buildings.

## API per service
**server (8600)**: `GET /health`, `POST /checkout`, `POST /hook`, `GET /state`, `WS /ws`, `POST /undo/{agent}`, `POST /merge/{agent}`, `POST /approve/{id}`, `GET /history?file=`, `GET /replay`.
**Jetson (8700)**: `GET /health`, `POST /check`, `POST /commit_msg`, `POST /ask`, `POST /summarize`, `POST /reset`.
**hook**: `python3 hooks/bullpen_hook.py <Event>` reads Claude Code hook JSON on stdin. Env: `SERVER_URL`, `BULLPEN_AGENT`.

## Done and to do
Open work is tracked as GitHub issues, titled with a checkpoint time and labeled by area.

| Area | Done | To do |
|---|---|---|
| `hooks/` | Posts every event to `/hook`; PreToolUse fails closed | Call `/checkout`; handle allow, wait, ask, deny; timeout over 60 s |
| `jetson/` | Deployed on the device; `/health`, `/check` (always allow), `/commit_msg`, `/ask` | `/check` rules (`db/**` = ask), `/reset`, pre-warm, `/summarize`, voice (stretch) |
| `scripts/` | `make_demo.sh`: demo repo, 3 worktrees, hook settings | `demo-seed/`, 3 prompts, `demo_start.sh`, `demo_reset.sh`, baseline without Bullpen |
| `server/` | Stub: `/health`, `/hook` (always allow), `/state` (event list), `/ws` (bare bodies), CORS | Everything in the flow: `/checkout` with leases, real git `/state`, WS envelope, undo, merge, approvals, auto-commit, history, replay |
| `web/` | Next.js app; campus scene with agents, flags, scaffolding, conflict flag, branch tabs, animations; side panel; fake mode and scripted demo; real-mode client with reconnect | Verify against the real server; intent card on merge; health strip; replay label; sprites and polish |
| `design/` | Caua's prototype lives in PR #1 for reference only. It is not merged. | |

## Machine notes (Dev's Mac and Jetson)
### Mac (dev machine, runs Claude Code)
- MacBook Pro, M5 Pro, 48 GB unified memory.
- Stable Ollama on the Mac: http://localhost:11434 with qwen2.5-coder:32b (backup model, 12 to 13 tok/s), qwen3-embedding:8b (4096 dims), nomic-embed-text (768 dims), and phonon TTS (`POST /v1/audio/speech` with `{"model":"phonon","input":"..."}`, returns 24 kHz WAV).
- Inkling 2 Mini (main model, ~20 GB, 33 to 34 tok/s), tag `inkling-2-mini:26b-a5b`, runs on a side-by-side Ollama 0.40.17-rc4 in ~/ollama-rc at http://localhost:11435. It is not a service: start it with `OLLAMA_HOST=127.0.0.1:11435 OLLAMA_FLASH_ATTENTION=1 nohup ~/ollama-rc/ollama serve > ~/ollama-rc/serve.log 2>&1 &`.
- Call Inkling through `/api/chat`; `/api/generate` with `"think": false` returns empty text on rc4. Load only one big model at a time (qwen 32b 20 to 24 GB, Inkling 22 GB loaded). The two Mac servers do not share memory: if qwen 32b is still loaded, Inkling fails with an out-of-memory 500. Run `ollama stop qwen2.5-coder:32b` before going back to Inkling. Keep-alive stays at the 5-minute default on the Mac for this reason.
- Python env: `~/hackkit` is a uv project (fastapi, uvicorn, httpx, ollama, numpy, pydantic), same lockfile on both machines. Run with `uv run`. Full kit notes: `~/hackkit/README.md`.

### Jetson (edge device)
- NVIDIA Jetson Orin Nano Super, 8 GB, Ubuntu 24.04, JetPack 7.2.2 (L4T 39.2.1; nvidia-l4t-* packages held, do not upgrade them).
- Login: `ssh dev@192.168.55.1` over the USB-C cable (key login, passwordless sudo). Hostname `dev`; `dev.local` resolves to the same address. USB is the demo path. Fallback: serial console `screen /dev/cu.usbmodem* 115200`.
- Not on Wi-Fi: USF-Guest has a captive portal. Leave Wi-Fi alone.
- The clock resets to 1970 on reboot. Fix it first each session: `ssh dev@192.168.55.1 "sudo date -u -s '$(date -u +%FT%TZ)'"`.
- No internet on the Jetson. For a download, tunnel through the Mac: `ssh -R 1080 dev@192.168.55.1 'curl -x socks5h://127.0.0.1:1080 ...'`.
- Ollama on the Jetson: http://192.168.55.1:11434. Bullpen service: http://192.168.55.1:8700 (deploy steps in `jetson/README.md`).
- Models: lfm3:1.7b-q4_K_M (agents and tool calls, 40 tok/s), qwen3.5:4b-q4_K_M (code, 16 tok/s), llama3.2:3b (23 tok/s), llama3.2:1b (44 tok/s), qwen2.5-coder:3b (24 tok/s). Embeddings: qwen3-embedding:0.6b (1024 dims) or nomic-embed-text (768 dims); never mix them in one index. Anything over ~7 GB will not fit in memory.
- lfm3 is a thinking model: call it through `/api/chat` with `"think": false` or with tools. Through `/api/generate` all output goes to the hidden thinking field. Use `num_ctx` 8192 for lfm3 and qwen3.5.
- lfm3 can return empty `content` when the user message is a bare diff (it spends the tokens on hidden output). Frame the input, for example `Diff:\n...\n\nCommit message:`, and it answers.
- Jetson Ollama runs with keep-alive forever and flash attention on (`/etc/systemd/system/ollama.service.d/perf.conf`). One chat model plus one embedder fits on the GPU. A second chat model splits to the CPU (qwen3.5 dropped from 16 to 12 tok/s), so run `ssh dev@dev.local ollama stop <old model>` before switching chat models.
- Speech to text: whisper.cpp with CUDA, `~/whisper.cpp/build/bin/whisper-cli -m ~/whisper.cpp/models/ggml-small.en.bin -f in.wav -nt` (16 kHz mono WAV, ~12x real time). `whisper-server` in the same folder serves HTTP.
- Text to speech: Piper, `piper --data-dir ~/voices -m en_US-lessac-medium -f out.wav -- "text"` (CPU, 5x real time once loaded).
- Python env: `~/hackkit` (uv). `uv` and `piper` are in /usr/local/bin, so one-line `ssh dev@dev.local '...'` commands find them.
- Wi-Fi power save is off by default (`/etc/NetworkManager/conf.d/wifi-powersave-off.conf`). The `hotspot` connection autoconnects.
- Power mode: MAXN SUPER, headless (multi-user.target), 16 GB swap on NVMe.
- Live power and GPU: `jtop`, or `sudo tegrastats` (VDD_IN is total board power in mW).

### Working across the two machines
- Deploy code to the Jetson with `rsync -av --exclude .venv --exclude __pycache__ ./jetson/ dev@192.168.55.1:~/app/`, then restart it per `jetson/README.md`.
- Only this Mac deploys to the Jetson. Teammates push to git, and this Mac pulls and deploys.
- Call both models through the Ollama HTTP API (`/api/generate` or the OpenAI-compatible `/v1/chat/completions`).
- Before the demo, confirm with `curl http://dev.local:11434/api/tags` and `ollama list` that every model is loaded.
