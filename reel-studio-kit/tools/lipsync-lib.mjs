// Loudness per video frame, from any audio file (needs ffmpeg).
// Output: mouth.json = [0.0 .. 1.0, one number per frame at 30 fps].
import { spawnSync } from "node:child_process";
import fs from "node:fs";

export const FPS = 30;

export const mouthFromAudio = (audioPath, fps = FPS) => {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", audioPath, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], { maxBuffer: 1 << 29 });
  if (r.error || r.status !== 0) throw new Error("ffmpeg could not read " + audioPath + " (is ffmpeg installed? brew install ffmpeg)");
  const b = r.stdout;
  const samples = new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4));
  const hop = Math.round(16000 / fps);
  const frames = Math.ceil(samples.length / hop);
  const rms = new Array(frames).fill(0);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    const a = f * hop;
    const e = Math.min(samples.length, a + hop * 1.5);
    for (let i = a; i < e; i++) s += samples[i] * samples[i];
    rms[f] = Math.sqrt(s / Math.max(1, e - a));
  }
  // normalise against the loud parts (95th percentile), ignore the noise floor
  const sorted = [...rms].sort((x, y) => x - y);
  const loud = sorted[Math.floor(sorted.length * 0.95)] || 1e-6;
  const floor = loud * 0.08;
  let prev = 0;
  return rms.map((v) => {
    const target = Math.min(1, Math.max(0, (v - floor) / (loud - floor)));
    prev = target > prev ? prev + (target - prev) * 0.7 : prev + (target - prev) * 0.35; // quick open, softer close
    return +prev.toFixed(3);
  });
};

export const writeMouthJson = async (audioPath, outPath) => {
  const m = mouthFromAudio(audioPath);
  fs.writeFileSync(outPath, JSON.stringify(m));
  return m;
};
