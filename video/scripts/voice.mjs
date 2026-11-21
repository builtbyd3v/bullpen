#!/usr/bin/env node
// ElevenLabs voiceover. The key comes from the environment or from video/.env (gitignored), never from the repo.
//   node scripts/voice.mjs list    your voices, cloned ones first
//   node scripts/voice.mjs make    one take per slot into raw/vo/<slot id>.mp3, with the voice in timeline.json
// video/.env:  ELEVENLABS_API_KEY=...
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(root, ".env"))) {
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*["']?(.*?)["']?\s*$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}
const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error("No ELEVENLABS_API_KEY. Put it in video/.env or export it in this terminal.");
  process.exit(1);
}
const api = async (path, init = {}) => {
  const res = await fetch(`https://api.elevenlabs.io${path}`, { ...init, headers: { "xi-api-key": key, "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
};

const mode = process.argv[2];
if (mode === "list") {
  const { voices } = await (await api("/v1/voices")).json();
  const rank = (v) => (v.category === "cloned" || v.category === "professional" ? 0 : v.category === "generated" ? 1 : 2);
  for (const v of voices.sort((a, b) => rank(a) - rank(b))) console.log(`${(v.category ?? "").padEnd(13)} ${v.name.padEnd(36)} ${v.voice_id}`);
} else if (mode === "make") {
  // The film's voice and its settings live in timeline.json ("voice"). The environment overrides them, for samples.
  const timeline = JSON.parse(readFileSync(join(root, "timeline.json"), "utf8"));
  const voice = process.env.ELEVENLABS_VOICE_ID ?? timeline.voice?.id;
  const settings = process.env.VOICE_SETTINGS ? JSON.parse(process.env.VOICE_SETTINGS) : (timeline.voice?.settings ?? {});
  if (!voice) {
    console.error("No voice. Run `node scripts/voice.mjs list`, then set \"voice\" in timeline.json.");
    process.exit(1);
  }
  const only = process.argv.slice(3);
  mkdirSync(process.env.VOICE_OUT ?? join(root, "raw/vo"), { recursive: true });
  for (const slot of timeline.slots) {
    if (!slot.vo || (only.length && !only.includes(slot.id))) continue;
    // The file name is read letter by letter, so it is spelled the way it should sound.
    const text = slot.vo.replaceAll("auth.ts", "auth dot T S");
    const res = await api(`/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: "POST",
      // VOICE_SETTINGS is JSON, for example {"stability":0.3,"style":0.45,"speed":1.1}.
      // Lower stability gives more emotion, style exaggerates the delivery, speed runs from 0.7 to 1.2.
      body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2", voice_settings: settings }),
    });
    // VOICE_OUT picks another folder, for samples that must not replace the takes in the film.
    const file = join(process.env.VOICE_OUT ?? join(root, "raw/vo"), `${slot.id}.mp3`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log(file);
  }
} else {
  console.error("Usage: node scripts/voice.mjs list | make [slot id ...]");
  process.exit(1);
}
