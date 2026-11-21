# Clips still to capture

- 10 app clips, all cut from one automated take: `node scripts/record.mjs live` in `video/`. Nobody films anything.
- The problem clip, the title and the closing card are generated. The voice is ElevenLabs.
- Capture waits for Dev's OK on the design. Before the take: `scripts/demo_reset.sh`, health strip all green.
- After the take: `npm run render`, then check each beat in `out/bullpen-demo.mp4`.

| Done | Slot | What the take must show | Length | Who, where |
|---|---|---|---|---|
| [ ] | `03-ask` | One ask typed in the Orchestrator box. Three bulls walk onto campus. | 10 s | Recorder, Dev's Mac |
| [ ] | `04-lock` | One agent holds `shared/auth.ts`, the other waits at the door. | 10 s | Recorder |
| [ ] | `05-deny` | db reaches for the schema. The approval card shows, the edit is denied. | 11 s | Recorder |
| [ ] | `06-undo` | Undo on web. Its commits leave the timeline. | 9 s | Recorder |
| [ ] | `07-merge` | Inside api's building, then Merge to main and the intent card. | 10 s | Recorder |
| [ ] | `08-unplug` | The referee OFFLINE, every edit blocked. | 10 s | Dev pulls the cable when the recorder says so (`UNPLUG=1`). Without Dev: the OFFLINE rows in the Referee panel. |
| [ ] | `09-evidence` | Locks panel close-up. | 9 s | Recorder |
| [ ] | `10-campus` | The campus with the agents at work. | 9 s | Recorder |
| [ ] | `11-interior` | Inside a building: agent at its file, branch sign, diff. | 5 s | Recorder |
| [ ] | `12-referee` | Referee log close-up: rule, latency, model per row. | 11 s | Recorder |
