# Bullpen demo video

- `npm run render` builds `out/bullpen-demo.mp4` (1:30, 1080p30) from `timeline.json` and whatever is in `raw/`.
- A missing clip renders as a labeled placeholder. A missing voiceover take is spoken by macOS `say`.
- `timeline.json` is the one place to change timing, trims, speed, labels and voiceover lines.
- The script: `SCRIPT.md`. What to record: `SHOTS.md`.
- Needs Node 24, ffmpeg and macOS (for the `say` placeholder voice).

## Render

```
cd video
npm install
npm run render      # out/bullpen-demo.mp4 and subtitles.srt, 1 to 2 minutes
npm run studio      # live preview; run `npm run prep` first
```

## Drop in recordings

1. Save each clip as `raw/<slot id>.mp4` or `.mov`, for example `raw/05-lock.mov`. Slot ids are in `timeline.json`.
2. Save each voiceover take as `raw/vo/<slot id>.m4a` (or `.wav`, `.mp3`).
3. Run `npm run render`.

Any size, codec or frame rate works: the build converts every clip to 1080p30 H.264.

## Sound

Three layers, mixed by the render:

| Layer | Source | Level |
|---|---|---|
| Voice | `raw/vo/<slot id>.m4a` | `mix.voice` |
| App sound | The audio track of each clip (the app's sound effects) | `mix.app`, lowered to `mix.appUnderVoice` while the voice plays |
| Music bed (optional) | `raw/music.mp3` (or `.wav`, `.m4a`). Loops, fades in over 1 s and out over 2 s | `mix.music`, lowered to `mix.musicUnderVoice` while the voice plays |

Levels are 0 to 1 and live in `mix` at the top of `timeline.json`. The level change takes 0.35 s on each side of a voice take. Set `"audio": false` on a slot to mute that clip. With `rate` other than 1, the clip's sound changes speed too: mute it. Use only music you have the rights to, and credit it.

## Fit a clip to its slot, in `timeline.json`

| Field | Meaning |
|---|---|
| `dur` | Seconds the slot lasts in the film |
| `start` | Second of the recording where the slot begins |
| `rate` | Playback speed. `2` shows 20 s of recording in a 10 s slot |
| `label` | Small on-screen label, top left |
| `audio` | `false` mutes the clip's own sound |
| `vo` | The voiceover line. Captions and `subtitles.srt` come from it |

The build stops with a clear message when a voiceover take is longer than its slot, or a clip is shorter than `start + dur x rate`.

## Automated recording

`node scripts/record.mjs live` opens Chrome at 1920x1080, types the ask, and drives the beats on the running stack: lock and wait, the referee's approval card (it clicks Deny), ask-why, a building interior, Undo on web, Merge on api, then the Locks and Referee panels. `node scripts/record.mjs fake` records the scripted `?fake` demo and needs no server.

- Output: `raw/take-<mode>.webm` plus `raw/take-<mode>.json` with the beat marks, the server events, and every sound note the app played.
- The recording has no sound track. The build plays the logged notes back at the right moments, with the same waves the app uses, under the voice.
- In `timeline.json`, a slot cuts from a take with `"src": "take-live"`, `"from": "<mark>"` and `start` (seconds after that mark). A new take keeps the same marks, so the cuts follow it.
- Run `scripts/demo_reset.sh` before a live take.
- `OFFLINE=1 node scripts/record.mjs live` adds a last step: it pauses the referee service on the Jetson over ssh, sends two edit requests through the real hook, and resumes the service. The server denies both, and those are the OFFLINE rows in the Referee panel. `UNPLUG=1` waits for a person to pull the cable instead.
- `node scripts/record.mjs conflict` records the pull-request conflict view from `/prs?fake`.
- Check each take for a gray band at the right edge: it appeared after the first Undo click in every take. The undo and merge slots are framed to leave it out.
- First use: `npx playwright-core install ffmpeg` (Playwright's video encoder, about 2 MB). Chrome must be installed. macOS asks for no Screen Recording permission, because Chrome records its own page.

## How it works

`scripts/build.mjs` converts the inputs with ffmpeg, times the captions to the length of each voiceover take, and writes `out/props.json`. Remotion (React rendered frame by frame in headless Chrome) then draws the title card, labels and captions and encodes the film. The ffmpeg build on the demo Mac has no text or subtitle filters, so all text is drawn by Remotion.

## Credits

- Remotion 4.0.545 (free license: teams of up to 3).
- ffmpeg.
- macOS `say` for placeholder voiceover only.
- playwright-core 1.65.1, to drive Chrome and record the app.
- ElevenLabs text to speech for the voiceover (stock voice "Jessica", model eleven_multilingual_v2).
- Bull sprite: the team's own pixel art from `web/app/bullSprite.ts`. Title lettering is drawn in code. Text uses the system monospace font (Menlo).
