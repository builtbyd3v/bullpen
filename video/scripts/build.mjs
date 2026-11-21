#!/usr/bin/env node
// Builds out/final.mp4 from timeline.json plus whatever is in raw/.
// Missing clip -> labeled placeholder slate. Missing voiceover -> macOS `say` placeholder.
// Usage: node scripts/build.mjs [--no-render]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...parts) => join(root, ...parts);
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] }).toString();
const ffmpeg = (args) => run("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const seconds = (file) => Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]));
const newer = (src, out) => !existsSync(out) || statSync(src).mtimeMs > statSync(out).mtimeMs;
const find = (dir, id) => readdirSync(p(dir)).find((f) => f.startsWith(id + "."));

const VO_MARGIN = 0.3;
const timeline = JSON.parse(readFileSync(p("timeline.json"), "utf8"));
for (const dir of ["public/clips", "public/vo", "out"]) mkdirSync(p(dir), { recursive: true });

const problems = [];
const cues = [];
let at = 0;

for (const slot of timeline.slots) {
  // Clip: QuickTime gives HEVC, odd sizes and a variable frame rate, so every input becomes 1080p30 H.264.
  slot.clip = null;
  const raw = slot.kind === "clip" && find("raw", slot.id);
  if (raw) {
    const out = `public/clips/${slot.id}.mp4`;
    const transfer = run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=color_transfer", "-of", "csv=p=0", p("raw", raw)]).trim();
    if (transfer === "arib-std-b67" || transfer === "smpte2084") console.warn(`WARNING ${raw} is HDR and will look washed out. Record again with HDR video off.`);
    if (newer(p("raw", raw), p(out))) {
      ffmpeg([
        "-i", p("raw", raw),
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0D231B,fps=30,format=yuv420p",
        "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-c:a", "aac", p(out),
      ]);
    }
    const need = (slot.start ?? 0) + slot.dur * (slot.rate ?? 1);
    const have = seconds(p(out));
    if (have + 0.05 < need) problems.push(`${slot.id}: clip is ${have.toFixed(1)} s, the slot needs ${need.toFixed(1)} s (start + dur x rate)`);
    slot.clip = `clips/${slot.id}.mp4`;
  }

  // Voiceover: the team's take if present, else a spoken placeholder that proves the line fits the slot.
  const voOut = `public/vo/${slot.id}.wav`;
  const take = find("raw/vo", slot.id);
  if (take) {
    if (newer(p("raw/vo", take), p(voOut))) ffmpeg(["-i", p("raw/vo", take), "-ar", "48000", "-ac", "2", p(voOut)]);
  } else {
    const spoken = slot.vo.replaceAll("auth.ts", "auth dot T S");
    run("say", ["-r", "150", "-o", p("out/say.aiff"), spoken]);
    ffmpeg(["-i", p("out/say.aiff"), "-ar", "48000", "-ac", "2", p(voOut)]);
  }
  slot.voFile = `vo/${slot.id}.wav`;
  const voDur = seconds(p(voOut));
  if (voDur > slot.dur - VO_MARGIN) {
    problems.push(`${slot.id}: voiceover is ${voDur.toFixed(1)} s, the slot is ${slot.dur} s. Cut words or raise "dur".`);
  }

  // Captions: lines of up to 8 words, timed by their share of the characters in the take.
  const lines = [];
  for (const sentence of slot.vo.split(/(?<=[.?!])\s+/)) {
    const words = sentence.split(" ");
    const parts = Math.ceil(words.length / 8);
    const size = Math.ceil(words.length / parts);
    for (let i = 0; i < words.length; i += size) lines.push(words.slice(i, i + size).join(" "));
  }
  const chars = lines.join("").length;
  let t = at;
  for (const text of lines) {
    const len = (text.length / chars) * voDur;
    cues.push({ from: t, to: t + len, text, burn: slot.kind !== "title" });
    t += len;
  }

  console.log(`${slot.id.padEnd(12)} ${String(slot.dur).padStart(2)} s  clip: ${slot.clip ? "raw" : slot.kind === "title" ? "title card" : "PLACEHOLDER"}  vo: ${take ? "raw" : "PLACEHOLDER"} ${voDur.toFixed(1)} s`);
  at += slot.dur;
}

const stamp = (s) => new Date(Math.round(s * 1000)).toISOString().slice(11, 23).replace(".", ",");
writeFileSync(p("subtitles.srt"), cues.map((c, i) => `${i + 1}\n${stamp(c.from)} --> ${stamp(c.to)}\n${c.text}\n`).join("\n"));
// Title cards already show their line on screen, so those cues stay in the .srt only.
writeFileSync(p("out/props.json"), JSON.stringify({ slots: timeline.slots, cues: cues.filter((c) => c.burn) }));
console.log(`total ${at} s, ${cues.length} captions -> subtitles.srt`);

if (problems.length) {
  console.error("\nFix these, then run again:\n- " + problems.join("\n- "));
  process.exit(1);
}
if (!process.argv.includes("--no-render")) {
  execFileSync("npx", ["remotion", "render", "src/index.tsx", "Film", "out/final.mp4", "--props=out/props.json"], { cwd: root, stdio: "inherit" });
  console.log(`\n${p("out/final.mp4")}  ${seconds(p("out/final.mp4")).toFixed(1)} s`);
}
