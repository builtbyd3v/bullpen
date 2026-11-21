# Clips still to capture

- 10 app clips, cut from automated takes: `node scripts/record.mjs live` in `video/`. Nobody films anything.
- The problem clip, the title and the closing card are generated. The voice is ElevenLabs (Jessica, speed 1.1).
- Capture waits for the dark-mode UI (branch `web/screens-dark`) to merge and for Dev's go.
- Before a take: `scripts/demo_reset.sh`, health strip all green. After it: `npm run render`, then check each beat in `out/bullpen-demo.mp4`.
- `02-conflict` comes from its own take: `node scripts/record.mjs conflict` (fake data, because the merge guard leaves no overlap on the real server).
- Before the take, set `BUILDING_X` and `BUILDING_Y` to the middle of api's building in the new layout (pixels in the 1920x1080 page, read from a screenshot).

| Done | Slot | What the take must show | Length | Who |
|---|---|---|---|---|
| [ ] | `02-conflict` | PR conflict view: #14 and #15 both clean against main, the overlapping shared/auth.ts lines highlighted. | 3.5 s | Recorder, after the dark-mode UI merges |
| [ ] | `04-ask` | One ask typed in the Orchestrator box, three bulls walk onto campus. | 7 s | Recorder |
| [ ] | `05-lock` | One agent holds shared/auth.ts, the other waits at the door. | 8 s | Recorder |
| [ ] | `06-deny` | Db reaches for the schema, the approval card shows, the edit is denied. | 9 s | Recorder |
| [ ] | `07-undo` | Undo on web, its commits leave the timeline. | 8 s | Recorder |
| [ ] | `08-merge` | Inside api's building, the real diff, then Merge to main and the intent card. | 8 s | Recorder |
| [ ] | `09-locks` | Locks panel close-up. | 8 s | Recorder |
| [ ] | `10-referee` | Referee log close-up: rule, latency, model per row. | 9 s | Recorder |
| [ ] | `11-offline` | Referee OFFLINE, every edit blocked (cable pulled during the take, or the OFFLINE rows in the referee log). | 5 s | Dev pulls the cable when the recorder says so (`UNPLUG=1`), or the recorder alone |
| [ ] | `12-commits` | The campus with agents at work and the commit timeline filling. | 6 s | Recorder |
