// Voice step. Usage:
//   npm run voice -- <reel-id> --provider openai       [--voice cedar] [--model gpt-4o-mini-tts|gpt-audio] [--style "warm, fast, energetic"]
//   npm run voice -- <reel-id> --provider elevenlabs   [--voice <voice id>] [--model eleven_multilingual_v2]
//   npm run voice -- <reel-id> --provider own          [--file ~/Downloads/my-recording.m4a]
// Reads  projects/<id>/voice.txt  (exactly what should be spoken)
// Writes public/reels/<id>/vo.wav
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import "../env.mjs";
import { root } from "../env.mjs";

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const provider = opt("provider", "");
if (!id || !["openai", "elevenlabs", "own"].includes(provider)) {
  console.error("Usage: npm run voice -- <reel-id> --provider openai|elevenlabs|own  (see README)");
  process.exit(1);
}
const outDir = path.join(root, "public/reels", id);
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "vo.wav");
const textFile = path.join(root, "projects", id, "voice.txt");
const text = fs.existsSync(textFile) ? fs.readFileSync(textFile, "utf8").trim() : "";

const toWav = (input, output, extra = []) => {
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", input, "-ac", "1", "-ar", "44100", ...extra, output], { encoding: "utf8" });
  if (r.status !== 0) { console.error("ffmpeg failed (is it installed? brew install ffmpeg):", r.stderr); process.exit(1); }
};
const done = () => {
  const p = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], { encoding: "utf8" });
  const secs = parseFloat(p.stdout);
  console.log(`Wrote ${out}${secs ? ` (${secs.toFixed(1)} s)` : ""}`);
  if (secs > 60) console.log("Warning: longer than 60 s. Tighten the script.");
  console.log(`Next: npm run sync -- ${id}`);
};

if (provider === "own") {
  const file = opt("file", "");
  if (file) toWav(path.resolve(file.replace(/^~/, process.env.HOME || "~")), out, ["-af", "loudnorm=I=-16:TP=-1.5:LRA=11"]);
  else if (!fs.existsSync(out)) { console.error(`Put your recording at ${out} (or pass --file <path>). Any format ffmpeg reads is fine.`); process.exit(1); }
  done();
  process.exit(0);
}

if (!text) { console.error(`${textFile} is empty or missing. Write the spoken text there first.`); process.exit(1); }

if (provider === "openai") {
  const { requireKey } = await import("../env.mjs");
  const key = requireKey("OPENAI_API_KEY", "https://platform.openai.com/api-keys");
  const model = opt("model", "gpt-4o-mini-tts");
  const voice = opt("voice", "cedar");
  const style = opt("style", "Speak like a friendly creator on a short video: natural, clear, upbeat, not robotic.");
  const tmp = path.join(outDir, "_raw.wav");
  if (model.startsWith("gpt-audio")) {
    // Chat Completions with audio output.
    const res = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        modalities: ["text", "audio"],
        audio: { voice, format: "wav" },
        messages: [
          { role: "system", content: `You are a voice actor. ${style} Read the user's text exactly, word for word. Do not add, skip or answer anything.` },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) { console.error("OpenAI error", res.status, await res.text()); process.exit(1); }
    const j = await res.json();
    const b64 = j.choices?.[0]?.message?.audio?.data;
    if (!b64) { console.error("No audio in the response:", JSON.stringify(j).slice(0, 400)); process.exit(1); }
    fs.writeFileSync(tmp, Buffer.from(b64, "base64"));
  } else {
    const res = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, voice, input: text, instructions: style, response_format: "wav" }),
    });
    if (!res.ok) { console.error("OpenAI error", res.status, await res.text()); process.exit(1); }
    fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  }
  toWav(tmp, out);
  fs.rmSync(tmp);
  done();
}

if (provider === "elevenlabs") {
  const { requireKey } = await import("../env.mjs");
  const key = requireKey("ELEVENLABS_API_KEY", "https://elevenlabs.io/app/settings/api-keys");
  const voice = opt("voice", process.env.ELEVENLABS_VOICE_ID || "");
  if (!voice) { console.error("Pass --voice <voice id> or set ELEVENLABS_VOICE_ID in .env (copy an ID from your ElevenLabs voice library)."); process.exit(1); }
  const model = opt("model", "eleven_multilingual_v2");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.45, similarity_boost: 0.8 } }),
  });
  if (!res.ok) { console.error("ElevenLabs error", res.status, await res.text()); process.exit(1); }
  const tmp = path.join(outDir, "_raw.mp3");
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  toWav(tmp, out);
  fs.rmSync(tmp);
  done();
}
