// Caption sync step. Usage:  npm run sync -- <reel-id> [--lang hi|en|auto] [--model small]
//   1. words.py  : local Whisper hears vo.wav and gives word times (free, offline after first model download)
//   2. align.py  : keeps YOUR words from projects/<id>/captions.txt and borrows Whisper's times
//   3. lipsync   : mouth.json (mouth openness per frame) for the avatar
// Writes public/reels/<id>/captions.words.json and mouth.json.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { root } from "./env.mjs";
import { writeMouthJson } from "./lipsync-lib.mjs";

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
if (!id) { console.error("Usage: npm run sync -- <reel-id> [--lang hi|en|auto] [--model small]"); process.exit(1); }
const lang = opt("lang", "auto");
const model = opt("model", "small");
const dir = path.join(root, "public/reels", id);
const vo = path.join(dir, "vo.wav");
const captions = path.join(root, "projects", id, "captions.txt");
const py = path.join(root, "tools/.venv/bin/python");
for (const [f, hint] of [[vo, "Run the voice step first."], [captions, "Write projects/<id>/captions.txt (the words shown on screen)."], [py, "Run: npm run setup:captions"]])
  if (!fs.existsSync(f)) { console.error(`Missing ${f}. ${hint}`); process.exit(1); }

const run = (script, a) => {
  const r = spawnSync(py, [path.join(root, "tools/captions", script), ...a], { encoding: "utf8" });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); process.exit(1); }
  return r.stdout;
};

const attempts = lang === "en" ? [false] : [false, true]; // Hindi/Hinglish: also try with captions as a spelling hint
let best = null;
for (const withPrompt of attempts) {
  const wf = path.join(dir, `_words${withPrompt ? "_hint" : ""}.json`);
  const of = path.join(dir, `_aligned${withPrompt ? "_hint" : ""}.json`);
  console.log(`Whisper (${model}, lang ${lang}${withPrompt ? ", with caption hint" : ""})...`);
  run("words.py", [vo, "--lang", lang, "--model", model, "-o", wf, ...(withPrompt ? ["--prompt-file", captions] : [])]);
  const report = run("align.py", ["--words", wf, "--captions", captions, "--audio", vo, "-o", of]);
  const matched = +(report.match(/Matched\s*:\s*(\d+)/)?.[1] ?? 0);
  if (!best || matched > best.matched) best = { matched, of, report };
}
fs.copyFileSync(best.of, path.join(dir, "captions.words.json"));
for (const f of fs.readdirSync(dir)) if (/^_(words|aligned)/.test(f)) fs.rmSync(path.join(dir, f));
console.log(best.report.replace(/\nWrote .*\n?/, "\n"));

const m = await writeMouthJson(vo, path.join(dir, "mouth.json"));
const words = JSON.parse(fs.readFileSync(path.join(dir, "captions.words.json"), "utf8"));
console.log(`captions.words.json: ${words.length} words, speech ends at ${words[words.length - 1]?.end}s. mouth.json: ${m.length} frames.`);
console.log("Check any 'Filled stretches' above by ear. If under 70% matched, captions.txt probably does not match what was spoken.");
