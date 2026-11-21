# Recording the demo (one page)

- 10 screen clips and 13 voice lines. Nothing is filmed with a camera. The problem clip, the title and the closing card are generated.
- Automated: `node scripts/record.mjs live` records every clip in one take and needs none of the screen steps below. They are the manual fallback.
- Tool: OBS, because it records the app's sound with the picture. Output 1920x1080, 30 fps.
- One clip per beat, in the order below. Two takes of each, keep the better one.
- Each clip runs 3 to 5 s longer than its slot. The build trims it.
- Then: `cd video && npm run render`. The film is `video/out/bullpen-demo.mp4`.

## Screen: set up once

1. Install OBS: `brew install --cask obs`. Allow Screen Recording when macOS asks, then restart OBS.
2. Settings, Video: base and output 1920x1080, 30 fps. Settings, Output: mp4, Apple VT H264, 12000 Kbps.
3. Add a source: "macOS Screen Capture", method "Window Capture", the Chrome window. It records the window and its sound. Right-click the source, Transform, Fit to screen.
4. Mute Mic/Aux in the mixer. Set the Mac volume to about 75%.
5. Chrome: http://localhost:5173, View, Enter Full Screen, zoom 110%. Turn on Do Not Disturb.

## Screen: the takes

Run `scripts/demo_reset.sh` before each run of the demo. The health strip must be all green. Do not talk during a take. Pause one second before and after each click.

| Order | Save as, in `video/raw/` | Slot | Do this |
|---|---|---|---|
| 1 | `03-ask` | 10 s | Type the ask in the Orchestrator box, press Enter. Three bulls walk on. |
| 2 | `04-lock` | 10 s | api holds `shared/auth.ts`, web waits at the door. Show the lease countdown. |
| 3 | `05-deny` | 11 s | db reaches for the schema. Show the deny row in the referee log. |
| 4 | `06-undo` | 9 s | Click Undo on web. Its commits leave the timeline. |
| 5 | `07-merge` | 10 s | Click api's building, show the diff, click Merge, the intent card. |
| 6 | `08-unplug` | 10 s | The referee OFFLINE. Pull the Jetson's cable if you are at the desk, then plug it back in. Otherwise show the OFFLINE rows in the Referee panel. |
| 7 | `09-evidence` | 9 s | Zoom 150% on the lease panel while a countdown runs. |
| 8 | `10-campus` | 8 s | Campus built from a second repo, then the commit timeline. |
| 9 | `11-interior` | 6 s | Inside a building: agent at its file, branch sign, diff. |
| 10 | `12-referee` | 10 s | Zoom 150% on the referee log: rule, latency, model. |

Beats 1 to 6 can be one continuous run cut into six files, or one long file: set `start` (the second where the beat begins) per slot in `timeline.json`. A slow beat: set `rate` to 2 and `"audio": false`.

## Voice (ElevenLabs)

1. The key is `ELEVENLABS_API_KEY` in your shell, or in `video/.env` (gitignored). Never commit it.
2. The voice and its settings are in `timeline.json` under `voice` (Jessica, stability 0.3, style 0.45). `node scripts/voice.mjs list` shows the other voices.
3. `node scripts/voice.mjs make` writes all 13 takes into `raw/vo/`. Add slot ids to redo single lines, for example `make 08-unplug`.
4. `npm run render`. If it says a take is too long for its slot, cut a word in `timeline.json` or raise that slot's `dur`.
