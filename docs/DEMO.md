# Demo script (3 min showcase + 1 min questions)

- One ask to the orchestrator starts 3 agents; Bullpen keeps them from overwriting each other.
- Live beats: collision, Sun Dome deny, ask why, undo, merge, then unplug the Jetson.
- Fallback: `GET /replay` on the server, or `?fake` plus "Play demo" in the web app.
- Before judging: run `scripts/demo_reset.sh`, check the health strip is all green.
- Start the server with `BULLPEN_RELEASE_ON_COMMIT=0` (in `server/`: `BULLPEN_RELEASE_ON_COMMIT=0 uv run uvicorn main:app --host 0.0.0.0 --port 8600`). Without it the lease drops at each auto-commit (about 1 s), so the second agent almost never waits and the collision beat does not show.
- Never cut: claims, the fence, undo.
- Timeline: project done by 3:00 PM, testing until 5:00 PM, pitch prep 5:30 PM, submit on MLH before 6:00 PM, judging 6:20 to 7:50 PM.

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
