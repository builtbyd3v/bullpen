# Demo script (3 min showcase + 1 min questions)

- One ask to the orchestrator starts 3 agents; Bullpen keeps them from overwriting each other.
- Live beats: collision, Sun Dome deny, ask why, undo, merge, then unplug the Jetson.
- Fallback: `GET /replay` on the server, or `?fake` plus "Play demo" in the web app.
- Before judging: run `scripts/demo_reset.sh`, check the health strip is all green.
- Never cut: claims, the fence, undo.

| Time | Beat | What the judge sees |
|---|---|---|
| 0:00-0:20 | Hook | "Git was built for humans. Three AI agents on one repo overwrite each other." Show the baseline number: lost edits without Bullpen. |
| 0:20-2:05 | Live | 1. One ask in the chat box. The orchestrator splits it and 3 agents (api, web, db) walk onto the campus. |
| | | 2. Collision: api and web both want `shared/auth.ts`. web waits under api's flag. |
| | | 3. Sun Dome: db edits the schema. The referee denies it, and db adapts. |
| | | 4. Ask why: "Why is db blocked?" The Jetson answers from local history. |
| | | 5. Undo web: its scaffolding collapses everywhere. |
| | | 6. Merge api: the intent card, then the building flashes. |
| 2:05-2:20 | Unplug | Pull the Jetson's cable. Every edit stops (fail closed). Plug it back in. |
| 2:20-3:00 | Tech walk | hook -> server `/checkout` -> Jetson `/check` -> lease -> auto-commit. Claude Code runs on the subscription; the Jetson does the referee work and the history on local models. Close: "Git was built for humans. Bullpen is version control for agents." |

## Questions to expect
- What did you build, and what is AI-generated? (See the README credits.)
- Why a Jetson? Rules on hardware the agents cannot reach; history that is free and private.
- What happens when the server or the Jetson is down? Every edit is denied.
