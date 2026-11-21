# 🐂 Bullpen

**Git was built for humans. Bullpen is version control for AI agents.**

HackJam '26, USF Tampa. Team: Monisha, Caua, Dev.

## The problem

Engineers now run several AI coding agents at once, and the tools still assume one human at a keyboard:

- **Agents collide.** Two agents editing one checkout overwrite each other. Giving each agent its own worktree only postpones the collision to merge time, when nobody is watching.
- **No one knows why.** A diff shows *what* changed, but not which agent changed it, for which task, or why.
- **You can't undo one agent.** If agent 2 goes off the rails, there is no clean way to remove only its work.

Code hosts built for agents already exist. Cursor's [Origin](https://cursor.com/changelog/origin-code-hosting) (Aug 2026) is a git host built into the Cursor client. As far as public coverage describes, it works where code is stored and reviewed, after the work is done. Bullpen works **at the edit, while the work is happening.** *Origin is where code lives. Bullpen is the referee during the game.*

## What it does

Core features (must work end to end by 3:00):

- [ ] **Leases, not conflicts.** An agent gets an exclusive write lease on a file the first time it edits it, and keeps the lease until its task is done. Another agent that tries the same file is denied with a reason ("`auth.py` is leased by agent web"). It does other work, and its Bull waits at the door until it retries. Reads are always free.
- [ ] **Guarded zones.** Risky folders (like `db/`) need a human yes or no. The agent's first try is denied with "pending approval," and the request appears in the Oracle panel. If the human approves, the agent's next try succeeds. If the human says no and adds a note ("add a migration instead"), the agent receives that note and changes course.
- [ ] **Every edit has a why.** Each edit is committed automatically, with git trailers for the agent, its task, and its reason. The Oracle panel shows every commit and decision live.
- [ ] **Undo one agent.** "Undo agent 2" runs `git revert` on that agent's commits only. Leases make this clean, because no other agent edited those files.

The **orchestrator** runs on the Jetson the whole time (see below). Stretch features, only after the core works:

- [ ] **Promote to prod:** a human-approved merge from `staging` into `main`, with a ribbon cutting on campus.
- [ ] **Construction overlay:** scaffolding on buildings that have changes on `staging` but not yet in `main`.
- [ ] **Ask the history:** "Why did the login file change?" answered from the commit trailers.
- [ ] **Voice** on the Jetson (whisper.cpp + Piper).

## The campus

The repo is drawn as a pixel USF campus (Phaser). Each folder is a building and each agent is a Bull. A Bull walks to the building it is editing in. When it is denied, it waits at the door; when a guarded zone says no, it bounces off. Undo takes down only that agent's work.

| Building | Folder | Notes |
|---|---|---|
| Marshall Student Center | `web/` | frontend |
| ENB | `api/` | backend |
| Library | `docs/` | |
| ENC | `tests/` | |
| Muma Business | `config/` | |
| Cooper Hall | `scripts/` | |
| Sun Dome | `db/` | **guarded** |
| Bull Runner stop | repo root | |
| Juniper-Poplar | anything unmapped | |

The source of truth is [campus/campus.json](campus/campus.json).

## How it works

**AI proposes, rules decide.**

```
┌──────────────────────────── Mac (demo machine) ─────────────────────────────┐
│                                                                             │
│  Claude Code agents ──hook on every tool call──▶ Referee (server/, :8600)   │
│  (one shared `staging`     PreToolUse: allow/deny    leases, guarded rules,  │
│   checkout of the demo     PostToolUse: commit       commit queue, undo,     │
│   repo, BULLPEN_AGENT=n)                             event hub ──WS──▶ Campus│
│                                                            ▲   (web/, :5173) │
└────────────────────────────────────────────────────────────┼────────────────┘
                                                             │ referee API (limited token)
                                      ┌──────── Jetson ──────┴──────────┐
                                      │ Orchestrator (jetson/, :8700)   │
                                      │ lfm3 tool calls: plan tasks,    │
                                      │ assign agents, react to denials │
                                      └─────────────────────────────────┘
```

- **The referee runs on the same Mac as the demo repo and the agents.** It runs git in the agents' checkout. The hook also *fails closed* (an unreachable referee means every edit is denied), so the referee must never sit across the hotspot from the agents.
- **One shared `staging` checkout, not one worktree per agent.** Agents really can overwrite each other here, which is exactly what leases prevent. It also means one branch, one commit queue, and undo as a plain revert.
- **The referee is plain code, not AI.** Rules have to be instant, consistent, and impossible to talk around (no prompt injection).
- **The orchestrator (AI, on the Jetson) is the coach.** It splits the goal into tasks, assigns them to agents, plans around current leases, and reacts to denials. It uses the referee's API with limited permissions: it can read leases, history, and events, assign tasks, and request lease reservations. It **can't** override a lease, approve a guarded zone, or approve a promote. *"AI is great at planning and bad at guarantees. So the AI coaches, the rules referee, and the coach can't change the rulebook."*

### On every agent tool call

1. **`PreToolUse`** (Edit, Write, MultiEdit, Bash) → the referee checks, in this order:
   - Is the file in a guarded zone without approval? Deny with "pending approval," and show the request in the Oracle panel.
   - Is it leased by another agent? Deny with the holder's name.
   - Otherwise allow, and grant or renew this agent's lease.
2. **`PostToolUse`** → the referee queues a commit. A single commit queue means no `index.lock` fights.
3. **Every decision and commit** goes out on `/ws` to the campus and the orchestrator.

### Design decisions

- **Leases bring back SVN/Perforce-style locking, rebuilt for agents.** *"Humans held locks for days. Agents hold them for one task, and release them automatically."*
  - The hook claims the lease, so no agent has to remember to check out.
  - A lease lasts until the agent's `Stop` hook fires or it has been idle for 2 minutes.
  - A denied agent gets a reason and moves on.
- **Leases are held for the whole task, not per edit.** Per-edit leases would let two agents take turns on one file and break per-agent undo.
- **One deny-and-retry pattern for both leases and approvals.** No hook ever holds a call open waiting for a human.
- **The "why":** the agent's last message before the edit, read from the hook's `transcript_path`. If that message is empty, a local model summarizes the diff. The task comes from `BULLPEN_TASK`.
- **Shell commands:**
  - A Bash command that names a guarded or leased path is checked like an edit.
  - After every Bash call, `git status` flags any changed file the agent did not hold a lease on.
  - Agents may not run `git` or call the referee directly.
- **Human-only endpoints** (approve, undo, promote) need a token that only the campus UI holds. This is a speed bump, not real security; the Bash rule above is what keeps agents from reaching them.
- **Future work (good for Q&A):** function-level leases so agents can share a file. The trade-off: mixed edits in one file make per-agent undo conflict.

## Repo layout and owners

| Path | Owner | What |
|---|---|---|
| `server/` | Monisha | Referee: leases, guarded rule + pending approvals, commit queue, undo, promote, event hub. Port 8600, runs on the Mac |
| `web/` | Caua | Campus, Bulls, Oracle panel (approve/deny/undo buttons). Port 5173 |
| `hooks/` | Dev | Claude Code hook: forwards events, applies allow/deny |
| `jetson/` | Dev | Orchestrator (lfm3) and optional voice. Port 8700. No lease logic |
| `scripts/make_demo.sh` | Dev | Demo repo: one shared `staging` checkout, hook wiring, per-agent `BULLPEN_AGENT` |
| `shared/events.md` | Monisha | **Event contract, the source of truth. Change it here first.** |
| `campus/campus.json` | Caua | Folder to building map |

Guarded zones span all three people: Monisha owns the rule and the pending-approval endpoint, Dev owns how the hook and agents react, and Caua owns the buttons.

## Running it

```sh
# Referee (on the Mac)
cd server && uv sync && uv run uvicorn main:app --host 0.0.0.0 --port 8600 --reload

# Campus
cd web && npm install && npm run dev        # http://localhost:5173

# Orchestrator on the Jetson (deployed from the Mac only)
rsync -av --exclude .venv ./jetson/ dev@dev.local:~/app/
ssh dev@dev.local 'cd ~/app && uv sync && uv run uvicorn main:app --host 0.0.0.0 --port 8700'

# Demo repo (wired to the hook)
./scripts/make_demo.sh
```

Smoke test: `curl -X POST localhost:8600/hook -H 'Content-Type: application/json' -d '{"agent":"api","event":"PreToolUse"}'`

## Demo (2 minutes, then about 1 minute of Q&A)

Three agents build one small feature, using scripted tasks.

1. **Collision → deny.** Two agents reach for the same file. One gets the lease, and the other's Bull waits at the door.
2. **Guarded zone → reroute.** An agent tries `db/`. We say "no, add a migration instead," and it reroutes.
3. **Undo agent 2.** One agent breaks something, and only its work comes down.

Backups: a full recording by 4:00, plus an event-replay mode where the referee re-sends logged events to the campus.

## Schedule (Sat Nov 21, ET)

| Time | Milestone |
|---|---|
| now | **Event contract in `shared/events.md`** (blocks Caua). `make_demo.sh` switched to a shared checkout. |
| by 1:00 | Hook → referee works. Leases with deny reasons. Commit queue. Campus moves one Bull from a mock stream. **Jetson go/no-go for the orchestrator.** |
| 1:00–3:00 | Real agents move the Bulls. Guarded zones with approve/deny. Undo one agent. Oracle feed. |
| **3:00** | **Core freeze.** |
| 3:00–5:00 | Stretch features, art polish. Backup recording by 4:00. Everyone explains the system out loud by 4:30. |
| **5:00** | **Feature freeze.** |
| 5:00–5:45 | Devpost write-up, AI credits, submit. |
| **6:00** | Submission closes. |

## AI credits

Claude Code (Claude Opus 5.5), which generated the initial scaffold and was used throughout. LFM3 (orchestrator). Also, if used: Inkling 2 Mini, Qwen 2.5 Coder, Qwen 3.5, Qwen3 Embedding, Llama 3.2, Nomic Embed, Whisper (whisper.cpp), Piper, phonon. *Trim this list to what we actually used.*
