# Clips still to capture

- 10 app clips, cut from automated takes: `node scripts/record.mjs live` in `video/`. Nobody films anything.
- The problem clip, the title and the closing card are generated. The voice is ElevenLabs (Jessica, speed 1.1).
- Capture waits for the dark-mode UI (branch `web/screens-dark`) to merge and for Dev's go.
- Before a take: `scripts/demo_reset.sh`, health strip all green. After it: `npm run render`, then check each beat in `out/bullpen-demo.mp4`.
- `02-conflict` comes from its own take: `node scripts/record.mjs conflict` (fake data, because the merge guard leaves no overlap on the real server).
- Before the final take: restart the server (it remembers approvals from earlier runs, so a once-approved `db/schema.sql` passes without a card), and make sure no other session resets or drives the stack during the 80 s take.
- api's building is clicked at (257, 605) in the 1920x1080 page. Check that against a screenshot if the layout changes again.

| Done | Slot | What the take must show | Length | Who |
|---|---|---|---|---|
| [ ] | `02-conflict` | PR conflict view: two agent branches, both clean against main, the overlapping shared/auth.ts lines highlighted. | 3.5 s | Recorder, after the dark-mode UI merges |
| [ ] | `04-ask` | One ask typed in the Orchestrator box, three bulls walk onto campus. | 7 s | Recorder |
| [ ] | `05-lock` | One agent holds shared/auth.ts, the other waits at the door. | 8 s | Recorder |
| [ ] | `06-deny` | Db reaches for a guarded file, the approval banner shows, the edit is denied, db writes a plan. | 9 s | Recorder |
| [ ] | `07-undo` | Undo on web, its commits leave the timeline. | 8 s | Recorder |
| [ ] | `08-merge` | Inside api's building with the real diff, then Merge to main and the other branches sync. | 8 s | Recorder |
| [ ] | `09-locks` | File locks panel close-up during the collision: holder, countdown, who waits. | 8 s | Recorder |
| [ ] | `10-referee` | Referee log close-up: decision, rule and latency per row. | 9 s | Recorder |
| [ ] | `11-offline` | Referee OFFLINE, every edit blocked (cable pulled during the take, or the OFFLINE rows in the referee log). | 5 s | Dev pulls the cable when the recorder says so (`UNPLUG=1`), or the recorder alone |
| [ ] | `12-commits` | Commits panel: one commit per edit with the Bullpen-Agent and Bullpen-Task trailers. | 6 s | Recorder |
