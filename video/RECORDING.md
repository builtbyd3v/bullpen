# Recording the demo (one page)

- 10 app clips and 13 voice lines. Nothing is filmed with a camera. The list is in `SHOTLIST-TODO.md`.
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

The slots, their lengths and what each must show are in `SHOTLIST-TODO.md`. Save a manual clip as `raw/<slot id>.mp4` and remove `src` and `from` from that slot in `timeline.json`.

## Voice (ElevenLabs)

1. The key is `ELEVENLABS_API_KEY` in your shell, or in `video/.env` (gitignored). Never commit it.
2. The voice and its settings are in `timeline.json` under `voice` (Jessica, stability 0.3, style 0.45). `node scripts/voice.mjs list` shows the other voices.
3. `node scripts/voice.mjs make` writes all 13 takes into `raw/vo/`. Add slot ids to redo single lines, for example `make 08-unplug`.
4. `npm run render`. If it says a take is too long for its slot, cut a word in `timeline.json` or raise that slot's `dur`.
