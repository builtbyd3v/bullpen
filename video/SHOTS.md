# Shots to record

- 10 app clips and 13 voice lines. Nothing is filmed with a camera. The list is in `SHOTLIST-TODO.md`.
- `node scripts/record.mjs live` captures all of these in one automated take. This page is the manual fallback.
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

The voice is ElevenLabs: `node scripts/voice.mjs make` writes one take per slot into `raw/vo/`. Steps are in `RECORDING.md`.

## Clips

The slots, their lengths and what each must show are in `SHOTLIST-TODO.md`. Save a manual clip as `raw/<slot id>.mp4` and remove `src` and `from` from that slot in `timeline.json`.

## Fallbacks

- A live beat fails in a take: record that beat from http://localhost:5173/campus?fake with "Play demo", or from the server's `GET /replay`.
- A real run is too slow for its slot: set `rate` to 2 or 3 for that slot, or raise `start` to skip the wait.
