# Bullpen demo video

- `npm run render` builds `out/final.mp4` (2:00, 1080p30) from `timeline.json` and whatever is in `raw/`.
- A missing clip renders as a labeled placeholder. A missing voiceover take is spoken by macOS `say`.
- `timeline.json` is the one place to change timing, trims, speed, labels and voiceover lines.
- The script: `SCRIPT.md`. What to record: `SHOTS.md`.
- Needs Node 24, ffmpeg and macOS (for the `say` placeholder voice).

## Render

```
cd video
npm install
npm run render      # out/final.mp4 and subtitles.srt, 1 to 2 minutes
npm run studio      # live preview; run `npm run prep` first
```

## Drop in recordings

1. Save each clip as `raw/<slot id>.mp4` or `.mov`, for example `raw/04-lock.mov`. Slot ids are in `timeline.json`.
2. Save each voiceover take as `raw/vo/<slot id>.m4a` (or `.wav`, `.mp3`).
3. Run `npm run render`.

Any size, codec or frame rate works: the build converts every clip to 1080p30 H.264 and mutes it (only `01-problem` keeps its sound, at 25%).

## Fit a clip to its slot, in `timeline.json`

| Field | Meaning |
|---|---|
| `dur` | Seconds the slot lasts in the film |
| `start` | Second of the recording where the slot begins |
| `rate` | Playback speed. `2` shows 20 s of recording in a 10 s slot |
| `label` | Small on-screen label, top left |
| `vo` | The voiceover line. Captions and `subtitles.srt` come from it |

The build stops with a clear message when a voiceover take is longer than its slot, or a clip is shorter than `start + dur x rate`.

## How it works

`scripts/build.mjs` converts the inputs with ffmpeg, times the captions to the length of each voiceover take, and writes `out/props.json`. Remotion (React rendered frame by frame in headless Chrome) then draws the title card, labels and captions and encodes the film. The ffmpeg build on the demo Mac has no text or subtitle filters, so all text is drawn by Remotion.

## Credits

- Remotion 4.0.545 (free license: teams of up to 3).
- ffmpeg.
- macOS `say` for placeholder voiceover only.
- Bull sprite: the team's own pixel art from `web/app/bullSprite.ts`. Title lettering is drawn in code. Text uses the system monospace font (Menlo).
