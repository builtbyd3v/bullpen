#!/usr/bin/env node
// Records the web app in Chrome at 1920x1080 and writes a sidecar log next to the take.
// Usage: node scripts/record.mjs fake    scripted demo in ?fake mode, no server needed
//        node scripts/record.mjs live    real mode: types one ask and drives the demo beats on the running stack
//        node scripts/record.mjs conflict    the cross-PR conflict view, from ?fake data, no server needed
//        UNPLUG=1 node scripts/record.mjs live    the same, then waits 14 s for a person to pull the Jetson's cable
// Output: raw/take-<mode>.webm, and raw/take-<mode>.json with
//   marks: [{ t, label }]   beat times, set by this script
//   notes: [{ t, freq, len, wave }]   every note the app played (the recording itself has no sound)
//   events: [{ t, type, agent }]   server events, live mode only
// All times are seconds from the first frame of the video.
import { chromium } from "playwright-core";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] ?? "fake";
const name = `take-${mode}`;
const url = process.env.WEB_URL ?? "http://localhost:5173";
const server = process.env.SERVER_URL ?? "http://localhost:8600";
const ask = process.env.ASK ?? "Add login with roles: API checks the role, web shows it, and the db stores it.";
const size = { width: 1920, height: 1080 };
const tmp = join(root, "out/rec");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(join(root, "raw"), { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: false });
const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, recordVideo: { dir: tmp, size } });
// Log each oscillator the app starts: one oscillator is one note of a sound effect.
await context.addInitScript(() => {
  const start = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (when = 0) {
    const now = this.context.currentTime;
    this.__note = { at: Date.now() + Math.max(0, when - now) * 1000, when: Math.max(when, now), freq: this.frequency.value, wave: this.type };
    return start.call(this, when);
  };
  const stop = OscillatorNode.prototype.stop;
  OscillatorNode.prototype.stop = function (when = 0) {
    if (this.__note) window.__note({ at: this.__note.at, freq: this.__note.freq, wave: this.__note.wave, len: Math.max(0.02, when - this.__note.when) });
    return stop.call(this, when);
  };
});
// Notes are sent to this process as they play, so a reload or a route change cannot lose them.
const played = [];
await context.exposeFunction("__note", (n) => played.push(n));
const page = await context.newPage();
const opened = Date.now();
const now = () => (Date.now() - opened) / 1000;
const marks = [];
const mark = (label) => {
  marks.push({ t: now(), label });
  console.log(`${now().toFixed(1).padStart(6)} s  ${label}`);
};
const pause = (s) => page.waitForTimeout(s * 1000);

// Live mode: a passive listener on the server's WebSocket, for beat timing only.
const events = [];
let ws;
if (mode === "live") {
  ws = new WebSocket(server.replace("http", "ws") + "/ws");
  ws.onmessage = (m) => {
    const e = JSON.parse(m.data);
    if (e.replay || e.type === "state") return;
    events.push({ t: now(), type: e.type, agent: e.data?.agent, file: e.data?.file ?? e.data?.target, decision: e.data?.decision });
  };
}
const seen = (type, agent) => events.find((e) => e.type === type && (!agent || e.agent === agent));
async function until(test, seconds) {
  const end = now() + seconds;
  while (now() < end) {
    if (test()) return true;
    await pause(0.25);
  }
  return false;
}
const click = async (locator, label) => {
  if (!(await locator.count())) return console.log(`        skipped ${label}: control not found`);
  mark(label);
  await locator.first().click({ timeout: 5000 }).catch((e) => console.log(`        ${label} click failed: ${e.message.split("\n")[0]}`));
};

// The app lives at /campus once the landing page takes over /. Use it when it exists.
const app = (await fetch(`${url}/campus`).then((r) => r.ok, () => false)) ? `${url}/campus` : url;
await page.goto(mode === "live" ? app : `${app}?fake`, { waitUntil: "load" });
await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
await pause(2);

if (mode === "conflict") {
  // The cross-PR conflict view, from fake data: on the real server the merge guard keeps two agent
  // branches from changing the same file, so a live run has no overlap to show.
  await page.goto(`${url}/prs?fake`, { waitUntil: "load" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await pause(1);
  mark("conflict");
  await pause(7);
} else if (mode === "fake") {
  await click(page.getByRole("button", { name: "Play demo" }), "play");
  await pause(23);
} else {
  // 1. One ask.
  await page.getByLabel("Orchestrate task").click();
  mark("ask");
  await page.getByLabel("Orchestrate task").pressSequentially(ask, { delay: 25 });
  await pause(0.5);
  await page.getByRole("button", { name: "Run", exact: true }).click();
  mark("run");

  // 2. Collision: first lock, then the second agent waits.
  if (await until(() => seen("claim_granted"), 120)) marks.push({ t: seen("claim_granted").t, label: "lock" });
  if (await until(() => seen("claim_wait"), 60)) marks.push({ t: seen("claim_wait").t, label: "wait" });

  // 3. Referee: db asks to edit a guarded folder. Let the card show, then deny.
  if (await until(() => seen("approval_needed"), 90)) {
    marks.push({ t: seen("approval_needed").t, label: "approval" });
    await pause(4);
    await click(page.getByRole("button", { name: "Deny", exact: true }), "deny");
    await pause(3);
  }

  // 4. Ask why.
  await page.getByLabel("Ask why").click();
  mark("askwhy");
  await page.getByLabel("Ask why").pressSequentially("Why is db blocked?", { delay: 30 });
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await pause(14);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await pause(1);

  // 5. Undo web, once both agents have commits to show.
  await until(() => seen("commit", "api") && seen("commit", "web"), 90);
  await click(page.getByRole("button", { name: "Undo", exact: true }).nth(1), "undo");
  await pause(6);

  // 6. Merge api: inside its building first, then back out and merge.
  mark("interior");
  // The campus is a canvas, so the building is clicked by position. Set BUILDING_X and BUILDING_Y (pixels in the
  // 1920x1080 page) to the middle of api's building, read from a screenshot of the current layout.
  await page.mouse.click(Number(process.env.BUILDING_X ?? 257), Number(process.env.BUILDING_Y ?? 605));
  await pause(7);
  await click(page.getByRole("button", { name: /back to campus/i }), "back");
  await pause(1.5);
  await click(page.getByRole("button", { name: "Merge to main", exact: true }).nth(0), "merge");
  await pause(9);

  // 7. Evidence panels for the technical section.
  // The Referee panel sits below the fold, so the page scrolls down to it. (File locks are cut from
  // the collision earlier in the take: by now no file is locked.)
  mark("referee");
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
  await pause(10);
  // 8. Optional: UNPLUG=1 waits for a person to pull the Jetson's cable, with the Referee panel and the health strip on screen.
  if (process.env.UNPLUG) {
    mark("unplug");
    console.log("\n>>> PULL THE JETSON CABLE NOW. Plug it back in when this script says so.\n\u0007");
    await pause(14);
    console.log("\n>>> PLUG THE CABLE BACK IN.\n\u0007");
    await pause(4);
  }
  mark("end");
}

const notes = played.map((n) => ({ t: (n.at - opened) / 1000, freq: n.freq, len: n.len, wave: n.wave }));
const video = page.video();
ws?.close();
await context.close();
await browser.close();
renameSync(await video.path(), join(root, `raw/${name}.webm`));
marks.sort((a, b) => a.t - b.t);
writeFileSync(join(root, `raw/${name}.json`), JSON.stringify({ marks, notes, events }, null, 1));
console.log(`raw/${name}.webm  ${marks.length} marks, ${notes.length} notes, ${events.length} events`);
