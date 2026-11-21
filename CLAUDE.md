# HackJam '26 project: environment notes

Hackathon: HackJam '26, USF Tampa, Sat Nov 21, 2026. Hacking 11:00 AM to 6:00 PM ET (submission closes 6:00 PM sharp). Judging is a live ~3 min showcase plus ~1 min Q&A.

## Rules that affect code
- No code written before 11:00 AM on Nov 21. Build everything in this repo fresh.
- All AI use must be credited in the submission (list models and tools). No reskins of existing AI tools.
- README and the MLH submission must list every framework and all AI usage in detail.
- One prize per team. Tracks: Best Overall, Home Turf, Off the Grid, Gemini API.
- Judging weights: Technical 25, Innovation 20, Track relevance 20, Execution 20, Presentation 15.
- Keep the scope to 2-3 core features that work end to end. Freeze features around 5:00 PM and leave the last hour for demo polish.

## Machines
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

## How to work across the two machines
- Deploy code to the Jetson with `rsync -av --exclude .venv --exclude __pycache__ ./jetson/ dev@192.168.55.1:~/app/`, then restart it per `jetson/README.md`.
- Only this Mac deploys to the Jetson. Teammates push to git, and this Mac pulls and deploys.
- Call both models through the Ollama HTTP API (`/api/generate` or the OpenAI-compatible `/v1/chat/completions`).
- Before the demo, confirm with `curl http://dev.local:11434/api/tags` and `ollama list` that every model is loaded.

## Project
Bullpen: version control built for AI agents. Git was built for humans.
Several Claude Code agents work in parallel git worktrees. A hook on every tool call reports to a referee server, which can deny edits (for example in guarded folders). The web app shows the repo as the USF campus: each folder is a building, and agents move between them live.

Owners:
- `server/` Monisha: FastAPI referee and event hub, port 8600.
- `web/` Caua: Next.js + React + Phaser campus view, port 5173.
- `jetson/`, `hooks/` Dev: local-model service on the Jetson (port 8700) and the Claude Code hook.

Shared files:
- Event contract (source of truth): `shared/events.md`. Change it there first.
- Folder to building map: `campus/campus.json`.
- Demo repo and agent worktrees: `scripts/make_demo.sh`.

main is protected: open a PR, CI must pass.

Mode: hackathon
