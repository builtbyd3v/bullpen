#!/usr/bin/env node
// Builds out/final.mp4 from timeline.json plus whatever is in raw/.
// Missing clip -> labeled placeholder slate. Missing voiceover -> macOS `say` placeholder.
// Usage: node scripts/build.mjs [--no-render]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...parts) => join(root, ...parts);
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] }).toString();
const ffmpeg = (args) => run("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const seconds = (file) => Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]));
const MEDIA = /\.(mp4|mov|m4v|mkv|webm|m4a|wav|mp3|aiff)$/i;
const find = (dir, id) => {
  const hits = readdirSync(p(dir)).filter((f) => f.startsWith(id + ".") && MEDIA.test(f));
  if (hits.length > 1) throw new Error(`${dir}/ has ${hits.length} files for ${id}: ${hits.join(", ")}. Keep one.`);
  return hits[0];
};
// Cuts dead air from both ends of a take, so captions and the length check follow the speech.
const TRIM = "silenceremove=start_periods=1:start_threshold=-45dB";
// Brings every take to the same loudness (-16 LUFS, the usual level for web video), so no line is quiet.
const LOUD = "loudnorm=I=-16:TP=-1.5:LRA=11";

const VO_MARGIN = 0.3;
const timeline = JSON.parse(readFileSync(p("timeline.json"), "utf8"));
for (const dir of ["public/clips", "public/vo", "public/sfx", "out"]) mkdirSync(p(dir), { recursive: true });

const problems = [];
const converted = new Set();
// One sound-effect note as a file: the same square or triangle wave with the same decay the app plays.
function noteFile(n) {
  const ms = Math.round(n.len * 1000);
  const file = `sfx/${n.wave}-${Math.round(n.freq)}-${ms}.wav`;
  if (!existsSync(p("public", file))) {
    const wave = n.wave === "triangle" ? `2/PI*asin(sin(2*PI*${n.freq}*t))` : `(2*gt(sin(2*PI*${n.freq}*t),0)-1)`;
    ffmpeg(["-f", "lavfi", "-i", `aevalsrc=0.15*${wave}*exp(-7.3*t/${n.len}):d=${n.len}:s=48000`, "-ac", "2", p("public", file)]);
  }
  return file;
}
const cues = [];
let at = 0;

for (const slot of timeline.slots) {
  // Clip: QuickTime gives HEVC, odd sizes and a variable frame rate, so every input becomes 1080p30 H.264.
  slot.clip = null;
  // "src" lets several slots cut from one long take, for example raw/take-live.webm.
  const src = slot.src ?? slot.id;
  const raw = slot.kind === "clip" && find("raw", src);
  if (raw && !converted.has(src)) {
    converted.add(src);
    const out = `public/clips/${src}.mp4`;
    const transfer = run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=color_transfer", "-of", "csv=p=0", p("raw", raw)]).trim();
    if (transfer === "arib-std-b67" || transfer === "smpte2084") console.warn(`WARNING ${raw} is HDR and will look washed out. Record again with HDR video off.`);
    // Converted on every run: a cache keyed on file dates kept old takes after a swap in Finder.
    ffmpeg([
      "-i", p("raw", raw),
      "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0D231B,fps=30,format=yuv420p",
      "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-c:a", "aac", p(out),
    ]);
  }
  if (raw) {
    const out = `public/clips/${src}.mp4`;
    // A recorder take has a sidecar log. "from" names a mark in it, and "start" then counts from that mark.
    const log = existsSync(p("raw", `${src}.json`)) ? JSON.parse(readFileSync(p("raw", `${src}.json`), "utf8")) : { marks: [], notes: [] };
    const rate = slot.rate ?? 1;
    let start = slot.start ?? 0;
    if (slot.from) {
      const m = log.marks.find((x) => x.label === slot.from);
      if (m) start += m.t;
      else problems.push(`${slot.id}: no mark "${slot.from}" in raw/${src}.json`);
    }
    slot.start = Math.max(0, start);
    const need = slot.start + slot.dur * rate;
    const have = seconds(p(out));
    if (have + 0.05 < need) problems.push(`${slot.id}: clip is ${have.toFixed(1)} s, the slot needs ${need.toFixed(1)} s (start + dur x rate)`);
    slot.clip = `clips/${src}.mp4`;
    // The app's sounds, placed where they fall in this slot. A sound keeps its own speed at any clip rate:
    // only its first note moves with the picture, and the notes after it keep their spacing.
    slot.sfx = [];
    let head = null;
    for (const n of [...log.notes].sort((x, y) => x.t - y.t)) {
      if (!head || n.t - head.t > 0.6) head = n;
      const at = (head.t - slot.start) / rate + (n.t - head.t);
      if (at >= 0 && at < slot.dur - 0.3) slot.sfx.push({ at, file: noteFile(n) });
    }
  }

  // Voiceover: the team's take if present, else a spoken placeholder that proves the line fits the slot.
  const voOut = `public/vo/${slot.id}.wav`;
  const take = find("raw/vo", slot.id);
  if (take) {
    ffmpeg(["-i", p("raw/vo", take), "-af", `${TRIM},areverse,${TRIM},areverse,${LOUD}`, "-ar", "48000", "-ac", "2", p(voOut)]);
  } else if (slot.vo) {
    const spoken = slot.vo.replaceAll("auth.ts", "auth dot T S");
    run("say", ["-r", "150", "-o", p("out/say.aiff"), spoken]);
    ffmpeg(["-i", p("out/say.aiff"), "-ar", "48000", "-ac", "2", p(voOut)]);
  }
  // A slot with no line and no take stays silent and gets no captions.
  const silent = !take && !slot.vo;
  slot.voFile = silent ? null : `vo/${slot.id}.wav`;
  const voDur = silent ? 0 : seconds(p(voOut));
  slot.voDur = voDur;
  if (voDur > slot.dur - VO_MARGIN) {
    problems.push(`${slot.id}: voiceover is ${voDur.toFixed(1)} s, the slot is ${slot.dur} s. Cut words or raise "dur".`);
  }

  // Captions: lines of up to 8 words, timed by their share of the characters in the take.
  const lines = [];
  for (const sentence of slot.vo ? slot.vo.split(/(?<=[.?!])\s+/) : []) {
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

  console.log(`${slot.id.padEnd(12)} ${String(slot.dur).padStart(2)} s  clip: ${slot.clip ? "raw" : slot.kind !== "clip" ? "generated" : "PLACEHOLDER"}  vo: ${take ? "raw" : "PLACEHOLDER"} ${voDur.toFixed(1)} s`);
  at += slot.dur;
}

const stamp = (s) => new Date(Math.round(s * 1000)).toISOString().slice(11, 23).replace(".", ",");
writeFileSync(p("subtitles.srt"), cues.map((c, i) => `${i + 1}\n${stamp(c.from)} --> ${stamp(c.to)}\n${c.text}\n`).join("\n"));
// Title cards already show their line on screen, so those cues stay in the .srt only.
// Optional music bed: raw/music.mp3 (or .wav, .m4a). It loops for the whole film and sits under the voice.
const bed = find("raw", "music");
if (bed) ffmpeg(["-i", p("raw", bed), "-ar", "48000", "-ac", "2", p("public/music.wav")]);
console.log(`music: ${bed ? "raw/" + bed : "none"}`);
writeFileSync(p("out/props.json"), JSON.stringify({ slots: timeline.slots, cues: cues.filter((c) => c.burn), mix: timeline.mix, music: bed ? "music.wav" : null }));
console.log(`total ${at} s, ${cues.length} captions -> subtitles.srt`);

if (problems.length) {
  console.error("\nFix these, then run again:\n- " + problems.join("\n- "));
  process.exit(1);
}
if (!process.argv.includes("--no-render")) {
  // --out=<name> picks the file name in out/, for example --out=bullpen-demo-v0.
  const name = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "bullpen-demo";
  execFileSync("npx", ["remotion", "render", "src/index.tsx", "Film", `out/${name}.mp4`, "--props=out/props.json"], { cwd: root, stdio: "inherit" });
  console.log(`\n${p(`out/${name}.mp4`)}  ${seconds(p(`out/${name}.mp4`)).toFixed(1)} s`);
}
