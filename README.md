# 🐂 Bullpen

**Git was built for humans. Bullpen is version control for agents.**

HackJam '26, USF Tampa. Team: Monisha, Caua, Dev. Track: Best Overall.

## The problem

Engineers now run several AI coding agents at once, and git still assumes one human at a keyboard:

- **Agents collide.** Two agents edit the same file, and nobody finds out until the merge conflict.
- **No one knows why.** A diff shows *what* changed, but not which agent changed it, for which task, or why.
- **You can't undo one agent.** If one agent goes off the rails, removing only its work is manual surgery.

Code hosts for agents already exist. Cursor's [Origin](https://cursor.com/changelog/origin-code-hosting) (Aug 2026) is a git host built into the Cursor client. As far as public coverage describes, it works where code is stored and reviewed, after the work is done. Bullpen works **at the edit, while the work is happening.** *Origin is where code lives. Bullpen is the referee during the game.*

## What it does

Several Claude Code agents work in parallel, each in its own git worktree and branch. Bullpen has three core features:

1. **The referee.** A hook asks the referee before every edit.
   - **Leases.** An agent gets a lease on the file it edits. If another agent holds that file, the agent is told to wait. It gets a reason, works elsewhere, and retries.
   - **Guarded zones.** Edits in `db/` need a human. The request appears in the web app, and no answer within 60 s means deny.
   - **Every edit has a why.** Each edit is committed automatically. A local model on the Jetson writes the commit message, and git trailers record the agent and its task (`Bullpen-Agent`, `Bullpen-Task`).
2. **Live layers.** The repo is drawn as the USF campus. Each folder is a building, `main` is the campus, and each agent's branch is a colored layer on top of it. Agents walk to the buildings they are editing.
3. **Merge and undo.** The human merges an agent's whole branch into `main`, with a one-line summary of the branch's intent from the Jetson. Or the human undoes the branch, and that agent's work disappears from the campus.

Stretch features: "why did this file change?" answered from history (`/history`, `/ask`), event replay, and voice on the Jetson.

## How it works

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

- **The referee's rules are plain code, not AI.** Rules have to be instant, consistent, and impossible to talk around. The local model only writes text: commit messages, branch summaries, and answers.
- **The Jetson is policy only.** It holds no lease state, and it is reached over a USB cable, not Wi-Fi.
- **Fail closed.** If the server or the Jetson is down, or a reply is bad, the edit is denied.
- **Leases bring back SVN/Perforce-style locking, rebuilt for agents.** Humans held locks for days. Agent leases are claimed automatically, renewed by activity, and released on commit, on `Stop`, or on expiry.

The full contract for every request, response, and WebSocket event is in [shared/events.md](shared/events.md).

| Service | Where | Port |
|---|---|---|
| Referee and event hub (`server/`) | Mac | 8600 |
| Campus web app (`web/`) | Mac | 5173 |
| Policy and local model (`jetson/`) | Jetson Orin Nano Super, over USB | 8700 |
| Hook (`hooks/bullpen_hook.py`) | runs inside each agent's Claude Code | |

## The campus

| Building | Folder | Notes |
|---|---|---|
| Marshall Student Center | `web/` | |
| ENB | `api/` | |
| Library | `docs/` | |
| ENC | `tests/` | |
| Muma Business | `config/` | |
| Cooper Hall | `scripts/` | |
| Sun Dome | `db/` | **guarded** |
| Bull Runner stop | repo root | the hub, where agents return after a merge or undo |
| Juniper-Poplar | anything unmapped | |

The source of truth is [campus/campus.json](campus/campus.json).

## Running it

```sh
# Referee
cd server && uv sync && uv run uvicorn main:app --host 0.0.0.0 --port 8600 --reload

# Campus (add ?fake to run without a server)
cd web && npm install && npm run dev        # http://localhost:5173

# Jetson service: deploy steps in jetson/README.md (from the Mac only)

# Demo repo: 3 agent worktrees wired to the hook
./scripts/make_demo.sh
```

## Repo layout and owners

| Folder | Owner |
|---|---|
| `server/` | Monisha |
| `web/`, `design/` | Caua |
| `hooks/`, `jetson/`, `scripts/`, `demo-seed/` | Dev |
| `shared/`, `campus/`, `CLAUDE.md`, `AGENTS.md` | shared (change through the contract first) |

## Schedule (Sat Nov 21, ET)

| Time | Milestone |
|---|---|
| **3:30 PM** | MVP freeze: the 3 core features work end to end |
| **5:00 PM** | Stop coding. Demo practice, write-up |
| **6:00 PM** | Submission closes |

Judging is a showcase of about 3 minutes plus 1 minute of Q&A at the table.

## Built with

- **Agents:** Claude Code, with Claude Code hooks
- **Referee:** Python, FastAPI, uvicorn, git
- **Web:** Next.js 16, React 19, Phaser 3, Tailwind CSS 4, TypeScript
- **Edge:** NVIDIA Jetson Orin Nano Super, Ollama, FastAPI, httpx
- **Tooling:** uv, npm, GitHub Actions

## AI credits

- **Claude Code** (Claude Opus 5.5): scaffolding, code, and docs throughout the build.
- **LFM3** (`lfm3:1.7b`, via Ollama on the Jetson): commit messages, branch summaries, and answers.
- *Add here anything else we actually use before submitting (for example Whisper and Piper if voice ships).*
