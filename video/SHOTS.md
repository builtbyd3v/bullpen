# Shots to record

- 10 clips and 13 voiceover takes. The short version of this page is `RECORDING.md`. File names must match the slot ids below.
- Record each beat as its own clip, 3 to 5 s longer than its slot. The build trims.
- Screen: a 16:9 box over the app (1504 x 846 on the MacBook), with the app's sound and no microphone. Voice: one take per beat.
- Run `scripts/demo_reset.sh` before each demo take. The health strip must be all green.
- Drop files into `video/raw/` and `video/raw/vo/`, then run `npm run render` in `video/`.

## Setup, once

1. Open http://localhost:5173 in Chrome. Choose View, Enter Full Screen. Zoom so the campus and the evidence panel are both readable (try 110%).
2. The MacBook screen is 16:10, and the film is 16:9. Record a 16:9 box, not the whole screen (next section). A whole-screen recording still works, with side bars.
3. Turn on Do Not Disturb. Hide the bookmarks bar. Close other tabs.
4. Make the pointer larger: System Settings, Accessibility, Display, Pointer size.

## Screen recording

| Tool | Settings |
|---|---|
| OBS (records the app's sound) | Install: `brew install --cask obs`. Source: "macOS Screen Capture", method "Window Capture", pick the Chrome window: it records the window and its sound together. Canvas and output 1920x1080, 30 fps, encoder Apple VT H264, 12000 Kbps, format mp4. Mute the Mic/Aux track in the mixer. |
| QuickTime (picture only) | Cmd+Shift+5, "Record Selected Portion". Drag the box until the size readout is 1504 x 846 and place it over the app. Options: Microphone "None", "Show Mouse Clicks" on. The box stays for the next take. Saves `.mov`. |

The app's sound effects are part of the film, so record with OBS. QuickTime's screen recording here takes a microphone only; a QuickTime clip still works and plays silent under the voice. Set the Mac volume to about 75% and do not talk during a take.

Move the pointer slowly. Pause one second before and after each click. Leave the top-left corner and the bottom strip free of key content: the label and the captions sit there.

## Voiceover

- QuickTime, New Audio Recording, quality Maximum. A phone with Voice Memos held 15 cm away also works.
- A quiet room, one speaker for all takes, one file per beat.
- Read the line from `SCRIPT.md`. Speak at a natural pace and aim for the "say" time shown there. The build fails if a take is longer than its slot minus 0.3 s.

## Clips

| File in `raw/` | Slot | Screen | What must be visible |
|---|---|---|---|
| `03-ask` | 10 s | Web app, real mode | Type the ask in the chat box, press Enter. Three bulls walk onto the campus. Speed up with `rate` if the split takes long. |
| `04-lock` | 10 s | Web app | api holds `shared/auth.ts`, web waits at the door. Lease panel: holder, countdown, queue. |
| `05-deny` | 11 s | Web app | db reaches for the schema at the Sun Dome. Referee log: the highlighted deny row with the `db/**` rule. db moves to other work. |
| `06-undo` | 9 s | Web app | Click Undo on web. Scaffolding collapses. web's commits leave the commit timeline. |
| `07-merge` | 10 s | Web app | Click api's building, show the interior and the diff, click Merge, the intent card, the flash. |
| `08-unplug` | 10 s | Web app, plus a phone clip if possible | Pull the Jetson's USB-C cable. Referee log shows OFFLINE, then denied edits. |
| `09-evidence` | 9 s | Web app, zoom 150% on the evidence panel | Leases with the TTL countdown running. |
| `10-campus` | 8 s | Terminal then web app | Run `scripts/make_campus.py` on a second repo, show the new campus, then the commit timeline with `Bullpen-Agent` trailers. |
| `11-interior` | 6 s | Web app | Building interior: agent at its file, branch sign, mini log, diff. |
| `12-referee` | 10 s | Web app, zoom 150% on the referee log | Rows with rule, latency and model. Or a phone shot of the Jetson next to the screen. |

`01-problem`, `02-title` and `13-close` are generated. Record voiceover takes for all 13 slots.

## Fallbacks

- A live beat fails on camera: record that beat from http://localhost:5173/campus?fake with "Play demo", or from the server's `GET /replay`.
- A real run is too slow for its slot: set `rate` to 2 or 3 for that slot, or raise `start` to skip the wait.
