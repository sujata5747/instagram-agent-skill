// Make things appear exactly when a word is spoken.
// words = [{ "word": "five", "start": 0.12, "end": 0.40 }, ...] (seconds). That is the
// format of public/reels/<id>/captions.words.json, made by `npm run sync -- <id>`.
import { FPS } from "./layout";

export type Word = { word: string; start: number; end: number };

const clean = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** seconds -> frame */
export const sec = (s: number, fps = FPS) => Math.round(s * fps);

/**
 * Timing helpers for one reel:
 *   const t = timing(words);
 *   t.at(5)                 frame where word number 5 starts (0 = first word)
 *   t.atText("tips")        frame where the first "tips" starts
 *   t.atText("rule", 0, 2)  ... the third "rule" (occurrence 2)
 *   t.duration()            video length in frames: last word + a short tail
 * `fallbackSec` is used when the word does not exist (e.g. before you have words).
 */
export const timing = (words: Word[], fps = FPS) => {
  const at = (n: number, fallbackSec = 0) => {
    const w = words[n];
    return w ? sec(w.start, fps) : sec(fallbackSec, fps);
  };
  const atText = (text: string, fallbackSec = 0, occurrence = 0) => {
    let seen = 0;
    for (let i = 0; i < words.length; i++) {
      if (clean(words[i].word) === clean(text)) {
        if (seen === occurrence) return at(i, fallbackSec);
        seen++;
      }
    }
    return sec(fallbackSec, fps);
  };
  const duration = (tailSec = 0.8, fallbackSec = 6) =>
    words.length ? sec(words[words.length - 1].end + tailSec, fps) : sec(fallbackSec, fps);
  return { at, atText, duration, words };
};

export type Timing = ReturnType<typeof timing>;
