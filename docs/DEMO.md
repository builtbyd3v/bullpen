# Demo plan (3 min showcase + 1 min questions)

- **The video is the demo.** It plays at the table; script and timings in `video/SCRIPT.md`, recorder in `video/`.
- **In person:** open the site (`/` landing, then `/campus`), let it run at rest, and optionally click one preset prompt chip and Run. All 3 chips reliably give the collision on `shared/auth.ts` and the Sun Dome approval within about 25 s. Click **Deny** on the approval card (no answer = deny after 60 s).
- **Between runs:** Settings, **Reset demo** (or `scripts/demo_reset.sh`). It also releases leftover locks through the server's undo.
- **Before judging:** start the server with `BULLPEN_RELEASE_ON_COMMIT=0` (in `server/`: `BULLPEN_RELEASE_ON_COMMIT=0 uv run uvicorn main:app --host 0.0.0.0 --port 8600`); without it the lock drops at each auto-commit (about 1 s) and the collision does not show. Pre-warm the Jetson (`POST /reset` on port 8700, about 70 s cold). Check the health strip. Click the page once and answer the browser's notification prompt so it does not pop up on stage.
- **Fallback:** `/campus?fake` plus "Play demo", or `GET /replay` on the server.
- Never cut: claims, the fence, undo.

## Beats (what the video shows, and what a chip run shows live)

| Time | Beat | What the judge sees |
|---|---|---|
| 0:00-0:20 | Problem opener | "Git was built for humans." 10 s in the UI: two agents overwrite `auth.ts`, the work is gone, no history. Show the baseline number: lost edits without Bullpen. "Now the same run with Bullpen." |
| 0:20-2:05 | Live | 1. "Point it at any repo and it builds your campus: each building is a top-level folder." One ask in the chat box. The orchestrator splits it and 3 agents (api, web, db) walk onto the campus. |
| | | 2. Collision: api and web both want `shared/auth.ts`. web waits under api's flag. Point at the lease panel: api holds the file, the countdown runs, web is in the queue. |
| | | 3. Sun Dome: db edits the schema. The referee denies it, and db adapts. Point at the referee log: the `db/**` rule matched, with its latency. "This decision came from the Jetson, not the agent." |
| | | 4. Ask why: "Why is db blocked?" The Jetson answers from local history. |
| | | 5. Undo web: its scaffolding collapses everywhere. Point at the commit timeline: web's commits are gone. "This is real git underneath: `git reset --hard main` in its worktree." |
| | | 6. Merge api: click the building first to zoom inside: api sits at the file it edited, with its branch sign, its action log and the real diff. Then the intent card, and the building flashes. |
| 2:05-2:20 | Unplug | Pull the Jetson's cable. The referee log shows OFFLINE and every edit is denied (fail closed). Plug it back in. |
| 2:20-3:00 | Tech walk | hook -> server `/checkout` -> Jetson `/check` -> lease -> auto-commit. Claude Code runs on the subscription; the Jetson does the referee work and the history on local models. Close: "Git was built for humans. Bullpen is version control for agents." |

## Questions to expect
- What did you build, and what is AI-generated? (See the README credits.)
- Why a Jetson? Rules on hardware the agents cannot reach; history that is free and private.
- What happens when the server or the Jetson is down? Every edit is denied.
