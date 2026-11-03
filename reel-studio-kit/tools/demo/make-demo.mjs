// Makes the demo's placeholder voice WITHOUT any API or speech engine:
//   projects/demo/captions.txt  ->  public/reels/demo/captions.words.json  (made-up but plausible timings)
//                               ->  public/reels/demo/vo.wav               (a soft robot hum, one burst per word)
//                               ->  public/reels/demo/mouth.json           (loudness per frame)
// It is a stand-in so the demo renders and the avatar talks. Real voice: see README, "Voice".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeMouthJson } from "../lipsync-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "public/reels/demo");
fs.mkdirSync(outDir, { recursive: true });

const tokens = fs.readFileSync(path.join(root, "projects/demo/captions.txt"), "utf8").split(/\s+/).filter(Boolean);

// Timings: longer words take longer, punctuation adds a pause.
let t = 0.25;
const words = tokens.map((w) => {
  const letters = w.replace(/[^\p{L}\p{N}]/gu, "").length;
  const start = t;
  const end = start + 0.12 + 0.032 * letters;
  t = end + (/[.?!]$/.test(w) ? 0.4 : /[:,]$/.test(w) ? 0.2 : 0.03);
  return { word: w, start: +start.toFixed(3), end: +end.toFixed(3) };
});
fs.writeFileSync(path.join(outDir, "captions.words.json"), JSON.stringify(words, null, 2));

// Audio: 24 kHz mono, harmonic hum per word with a little pitch movement.
const sr = 24000;
const total = Math.ceil((words[words.length - 1].end + 0.8) * sr);
const pcm = new Float32Array(total);
words.forEach((w, wi) => {
  const f0 = 118 + ((wi * 37) % 40) + (/[?]$/.test(w.word) ? 25 : 0);
  const n0 = Math.floor(w.start * sr);
  const n1 = Math.floor(w.end * sr);
  let phase = 0;
  for (let n = n0; n < n1 && n < total; n++) {
    const u = (n - n0) / (n1 - n0);
    const env = Math.min(1, u / 0.12) * Math.min(1, (1 - u) / 0.25) * (0.75 + 0.25 * Math.sin(u * Math.PI * 3));
    const f = f0 * (1 + 0.08 * Math.sin(u * Math.PI));
    phase += (2 * Math.PI * f) / sr;
    let s = 0;
    for (let h = 1; h <= 8; h++) s += Math.sin(phase * h) / (h * 1.2);
    pcm[n] += s * env * 0.16;
  }
});

const wav = Buffer.alloc(44 + total * 2);
wav.write("RIFF", 0); wav.writeUInt32LE(36 + total * 2, 4); wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sr, 24); wav.writeUInt32LE(sr * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write("data", 36); wav.writeUInt32LE(total * 2, 40);
for (let i = 0; i < total; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), 44 + i * 2);
fs.writeFileSync(path.join(outDir, "vo.wav"), wav);

await writeMouthJson(path.join(outDir, "vo.wav"), path.join(outDir, "mouth.json"));
console.log(`demo: ${words.length} words, ${(total / sr).toFixed(1)} s, wrote ${outDir}`);
console.log("last word starts at", words[words.length - 1].start, "s");
console.log(words.map((w, i) => `${i}:${w.word}@${w.start}`).join("  "));
