// Usage: npm run lipsync -- <reel-id>
// Reads public/reels/<id>/vo.wav and writes public/reels/<id>/mouth.json (mouth openness per frame).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeMouthJson } from "./lipsync-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const id = process.argv[2];
if (!id) { console.error("Usage: npm run lipsync -- <reel-id>"); process.exit(1); }
const dir = path.join(root, "public/reels", id);
const wav = fs.existsSync(path.join(dir, "vo.wav")) ? path.join(dir, "vo.wav") : null;
if (!wav) { console.error(`No ${dir}/vo.wav yet. Run the voice step first.`); process.exit(1); }
const m = await writeMouthJson(wav, path.join(dir, "mouth.json"));
console.log(`mouth.json: ${m.length} frames (${(m.length / 30).toFixed(1)} s)`);
