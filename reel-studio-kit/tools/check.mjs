// The self-check. Usage: npm run check -- <CompositionId> [--every 15] [--mp4 out/<id>.mp4]
//
// Renders still frames of the reel (with the Instagram safe zones drawn on), measures every
// element on every frame, and builds a contact sheet you (or Claude) can LOOK at.
//   out/<id>/check/contact-sheet.jpg   one thumbnail per second, safe zones drawn in red
//   out/<id>/check/f_<frame>.jpg       full-size frames, to zoom into anything suspicious
//   out/<id>/check/report.json         every finding
// Finds: text overflow, elements outside the safe zone, overlapping elements, empty scenes,
// hook not visible in the first second, scenes too long/short, reel too long, frozen stretches.
// Exit code 1 = something to fix.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { browserFlag, fallbackBrowser } from "./browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const opt = (name, d) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : d; };
if (!id) { console.error("Usage: npm run check -- <CompositionId> [--every 15]"); process.exit(1); }
const every = parseInt(opt("every", "15"), 10);
const mp4 = opt("mp4", `out/${id}.mp4`);
const dir = path.join(root, "out", id, "check");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

// --- browser
let browserExecutable = browserFlag() || undefined;
const open = async () => {
  await ensureBrowser({ browserExecutable });
  return openBrowser("chrome", { browserExecutable });
};
let browser;
try { browser = await open(); } catch (e) {
  const fb = fallbackBrowser();
  if (!fb) throw e;
  console.log("Remotion's browser failed, using installed Chrome.");
  browserExecutable = fb;
  browser = await open();
}

console.log("Bundling...");
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });

const logs = [];
const onBrowserLog = (l) => { if (l.text.startsWith("REEL_PROBE ")) logs.push(JSON.parse(l.text.slice(11))); };
const inputProps = { probe: true, debugSafeZones: true };
const composition = await selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser });
const fps = composition.fps;
const total = composition.durationInFrames;

const frames = [...new Set([0, 8, ...Array.from({ length: Math.floor(total / every) + 1 }, (_, i) => i * every), total - 1])].filter((f) => f < total).sort((a, b) => a - b);
console.log(`Checking ${frames.length} frames of ${id} (${(total / fps).toFixed(1)} s)...`);
for (const frame of frames) {
  await renderStill({
    composition, serveUrl, frame, inputProps, puppeteerInstance: browser, onBrowserLog,
    output: path.join(dir, `f_${String(frame).padStart(5, "0")}.jpg`), imageFormat: "jpeg", jpegQuality: 82,
  });
}
await browser.close({ silent: true });

// --- analysis
const findings = [];
const add = (severity, type, detail, frameList = []) => findings.push({ severity, type, detail, frames: frameList });
const byFrame = new Map(logs.map((l) => [l.frame, l]));
const probed = frames.map((f) => byFrame.get(f)).filter(Boolean);
if (probed.length !== frames.length) add("fix", "probe", `Only ${probed.length}/${frames.length} frames reported measurements. Is <ReelFrame probe={probe}> used in the reel?`);

// element issues, grouped
const groups = new Map();
for (const p of probed) for (const i of p.issues) {
  const key = `${i.type}|${i.el}|${p.scene}`;
  if (!groups.has(key)) groups.set(key, { ...i, scene: p.scene, frames: [], detail: i.detail });
  groups.get(key).frames.push(p.frame);
}
for (const g of groups.values()) add("fix", g.type, `${g.el} in scene "${g.scene}": ${g.detail}`, g.frames);

// empty scene: two samples in a row with no content element
for (let i = 1; i < probed.length; i++) {
  if (probed[i].frame > 8 && probed[i].content === 0 && probed[i - 1].content === 0 && probed[i - 1].frame > 0)
    add("fix", "empty", `No content on screen around ${(probed[i - 1].frame / fps).toFixed(1)}-${(probed[i].frame / fps).toFixed(1)} s (only avatar/captions)`, [probed[i - 1].frame, probed[i].frame]);
}

// hook
const firstContent = probed.find((p) => p.content > 0);
if (!firstContent || firstContent.frame > fps) add("fix", "hook", `Hook is not on screen within the first second (first content at ${firstContent ? (firstContent.frame / fps).toFixed(1) : "never"} s)`);

// scenes
const runs = [];
for (const p of probed) {
  const last = runs[runs.length - 1];
  if (last && last.name === p.scene) last.end = p.frame + every; else runs.push({ name: p.scene, start: p.frame, end: p.frame + every });
}
runs.forEach((r, idx) => {
  r.end = Math.min(r.end, total);
  const len = (r.end - r.start) / fps;
  const edge = idx === 0 || idx === runs.length - 1; // hook and end card may be short or long
  if (!r.name) return;
  if (len > 9) add("warn", "pacing", `Scene "${r.name}" lasts about ${len.toFixed(1)} s. Aim for a new scene every 4-8 s.`);
  if (len < 2.5 && !edge) add("warn", "pacing", `Scene "${r.name}" lasts only about ${len.toFixed(1)} s. Very short scenes feel rushed.`);
});
if (total / fps > 60) add("warn", "length", `Reel is ${(total / fps).toFixed(1)} s. Keep it under 60 s.`);
if (total / fps > 90) add("fix", "length", `Reel is ${(total / fps).toFixed(1)} s. Reels longer than 90 s are not allowed.`);

// frozen picture (needs a rendered mp4)
const mp4Path = path.join(root, mp4);
if (fs.existsSync(mp4Path)) {
  const r = spawnSync("ffmpeg", ["-v", "info", "-i", mp4Path, "-vf", "freezedetect=n=-55dB:d=2", "-an", "-f", "null", "-"], { encoding: "utf8" });
  const starts = [...(r.stderr || "").matchAll(/freeze_start: ([\d.]+)/g)].map((m) => +m[1]);
  const durs = [...(r.stderr || "").matchAll(/freeze_duration: ([\d.]+)/g)].map((m) => +m[1]);
  starts.forEach((s, i) => add("warn", "frozen", `Picture barely changes from ${s.toFixed(1)} s for ${(durs[i] ?? 0).toFixed(1)} s. Something should move every ~2 s.`));
} else {
  add("info", "frozen", `Frozen-picture test skipped (no ${mp4}). Render first for the full check.`);
}

// --- contact sheet
const step = Math.max(1, Math.round(fps / every)); // samples per second
const perThumb = probed.length > 45 * step ? 2 : 1;
const picks = frames.filter((f, i) => f === 0 || f % (fps * perThumb) === 0 || i === frames.length - 1).filter((f, i, a) => a.indexOf(f) === i);
picks.forEach((f, i) => fs.copyFileSync(path.join(dir, `f_${String(f).padStart(5, "0")}.jpg`), path.join(dir, `c_${String(i).padStart(3, "0")}.jpg`)));
const cols = Math.min(8, picks.length);
const rows = Math.ceil(picks.length / cols);
const sheet = spawnSync("ffmpeg", ["-y", "-v", "error", "-framerate", "1", "-i", path.join(dir, "c_%03d.jpg"), "-vf", `scale=216:384,tile=${cols}x${rows}:padding=6:color=0x222222`, "-frames:v", "1", path.join(dir, "contact-sheet.jpg")], { encoding: "utf8" });
if (sheet.status !== 0) add("warn", "contact-sheet", "ffmpeg could not build the contact sheet: " + sheet.stderr);
picks.forEach((_, i) => fs.rmSync(path.join(dir, `c_${String(i).padStart(3, "0")}.jpg`)));

const out = { id, seconds: +(total / fps).toFixed(2), sampledFrames: frames.length, scenes: runs.map((r) => ({ ...r, seconds: +((r.end - r.start) / fps).toFixed(1) })), thumbnails: picks.map((f) => +(f / fps).toFixed(1)), findings };
fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(out, null, 2));

const fmt = (fr) => (fr.length ? ` [${fr.length > 4 ? `${(fr[0] / fps).toFixed(1)}-${(fr[fr.length - 1] / fps).toFixed(1)} s` : fr.map((f) => (f / fps).toFixed(1) + " s").join(", ")}]` : "");
const fixes = findings.filter((f) => f.severity === "fix");
console.log(`\nScenes: ${out.scenes.map((s) => `${s.name || "?"} ${s.seconds}s`).join(" | ")}`);
for (const f of findings) console.log(`${f.severity.toUpperCase().padEnd(4)} ${f.type}: ${f.detail}${fmt(f.frames)}`);
console.log(fixes.length ? `\n${fixes.length} thing(s) to fix.` : "\nNo blocking problems found by the automatic checks. Now LOOK at the contact sheet.");
console.log(`Contact sheet: ${path.join(dir, "contact-sheet.jpg")}  (thumbnail times in seconds: ${out.thumbnails.join(", ")})`);
process.exit(fixes.length ? 1 : 0);
