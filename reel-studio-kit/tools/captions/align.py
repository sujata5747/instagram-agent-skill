#!/usr/bin/env python3
"""align.py - put YOUR caption words on Whisper's timings.

Whisper (words.py) tells you when each word was spoken, but in Hindi it can
skip whole stretches or spell words differently (Devanagari vs Roman). This
script keeps the exact words from your captions.txt and borrows the time from
Whisper wherever the two agree. For stretches Whisper missed, it spreads your
words across the real speech in the audio (silences are skipped).

  python align.py --words words.json --captions captions.txt --audio vo.wav

Output: captions.words.json, same format as words.json:
  [{"word": "Ye", "start": 0.4, "end": 0.6}, ...]
"""
import argparse
import difflib
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import numpy as np

# ---------------------------------------------------------------- matching key
# Goal: "video" (Roman) and "वीडियो" (Devanagari) should look alike. We turn both
# into a rough consonant skeleton ("vd" / "vdy") and compare those.

DEVA_CONS = {
    "क": "k", "ख": "k", "ग": "g", "घ": "g", "ङ": "n", "च": "C", "छ": "C", "ज": "j", "झ": "j", "ञ": "n",
    "ट": "t", "ठ": "t", "ड": "d", "ढ": "d", "ण": "n", "त": "t", "थ": "t", "द": "d", "ध": "d", "न": "n",
    "प": "p", "फ": "f", "ब": "b", "भ": "b", "म": "m", "य": "y", "र": "r", "ल": "l", "व": "v",
    "श": "S", "ष": "S", "स": "s", "ह": "h", "ळ": "l",
}
NUKTA_FIX = {"क": "k", "ख": "k", "ग": "g", "ज": "j", "ड": "r", "ढ": "r", "फ": "f"}
DEVA_DIGITS = {ord(c): str(i) for i, c in enumerate("०१२३४५६७८९")}
VOWELS = set("aeiouAEIOU")


def deva_to_latin(text: str) -> str:
    """Very rough Devanagari -> Latin (consonants matter, vowels are dropped later)."""
    text = text.translate(DEVA_DIGITS)
    out = []
    for i, ch in enumerate(text):
        if ch in DEVA_CONS:
            nxt = text[i + 1] if i + 1 < len(text) else ""
            out.append(NUKTA_FIX.get(ch, DEVA_CONS[ch]) if nxt == "़" else DEVA_CONS[ch])
            out.append("a")  # inherent vowel; a following virama takes it back
        elif "ऀ" <= ch <= "ॿ":
            if ch in "अआइईउऊऋएऐओऔ" or ch in "ािीुूृेैोौ":
                out.append("a")
            elif ch in "ंँ":
                out.append("n")
            elif ch == "\u094d" and out and out[-1] == "a":  # virama: no inherent vowel
                out.pop()
            # nukta, visarga, danda: nothing
        else:
            out.append(ch)
    return "".join(out)


def skeleton(word: str) -> str:
    w = unicodedata.normalize("NFC", word)
    w = deva_to_latin(w)
    w = w.replace("C", "\x01").replace("S", "\x02")  # protect ch / sh from the Roman rules below
    w = w.lower()
    w = re.sub(r"[^a-z0-9\x01\x02]", "", w)
    w = w.replace("chh", "\x01").replace("ch", "\x01").replace("sh", "\x02").replace("ph", "f")
    w = re.sub(r"([kgtdbj])h", r"\1", w)
    w = w.replace("x", "ks").replace("q", "k").replace("c", "k").replace("w", "v").replace("z", "j")
    w = re.sub(r"(?<=[aeiou])h$", "", w)  # "toh", "nah": silent h
    w = re.sub(r"y$", "", w) if len(w) >= 2 else w  # "by", "tay": final y is a vowel
    w = re.sub(r"[aeiou]", "", w)
    w = re.sub(r"(.)\1+", r"\1", w)
    return w


def similarity(a: str, b: str) -> float:
    """0..1 how alike two skeletons are."""
    if a == b:
        return 1.0 if a else 0.65  # both empty (e.g. "AI" vs "एआई"): weak match
    if not a or not b:
        return 0.0
    if min(len(a), len(b)) == 1:  # one-letter skeletons must match exactly
        return 0.0
    return difflib.SequenceMatcher(None, a, b).ratio()


THRESHOLD = 0.66

# ------------------------------------------------------------------ alignment


def align_tokens(cap_keys, wh_keys):
    """Weighted LCS style DP. Moves: 1-1, caption word = two whisper words, two caption words = one whisper word.
    Returns list of (caption_index, [whisper indices])."""
    n, m = len(cap_keys), len(wh_keys)
    NEG = -1e9
    score = [[NEG] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    score[0][0] = 0.0
    for i in range(n + 1):
        for j in range(m + 1):
            cur = score[i][j]
            if cur == NEG:
                continue
            moves = []
            if i < n:
                moves.append((i + 1, j, 0.0, "skipc"))
            if j < m:
                moves.append((i, j + 1, 0.0, "skipw"))
            if i < n and j < m:
                s = similarity(cap_keys[i], wh_keys[j])
                if s >= THRESHOLD:
                    moves.append((i + 1, j + 1, 1.0 + s, "m11"))
            if i < n and j + 1 < m:  # one caption word spoken as two whisper words
                s = similarity(cap_keys[i], wh_keys[j] + wh_keys[j + 1])
                if s >= THRESHOLD + 0.1:
                    moves.append((i + 1, j + 2, 1.6 + s, "m12"))
            if i + 1 < n and j < m:  # two caption words heard as one whisper word
                s = similarity(cap_keys[i] + cap_keys[i + 1], wh_keys[j])
                if s >= THRESHOLD + 0.1:
                    moves.append((i + 2, j + 1, 1.6 + s, "m21"))
            for ni, nj, gain, kind in moves:
                if cur + gain > score[ni][nj]:
                    score[ni][nj] = cur + gain
                    back[ni][nj] = (i, j, kind)
    pairs = []
    i, j = n, m
    while (i, j) != (0, 0):
        pi, pj, kind = back[i][j]
        if kind == "m11":
            pairs.append(([pi], [pj]))
        elif kind == "m12":
            pairs.append(([pi], [pj, pj + 1]))
        elif kind == "m21":
            pairs.append(([pi, pi + 1], [pj]))
        i, j = pi, pj
    pairs.reverse()
    return pairs


# ------------------------------------------------------------ silence detection


def load_audio(path: str, sr: int = 16000):
    """Mono float32 samples. ffmpeg handles any format; soundfile is the fallback."""
    try:
        raw = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
            check=True, capture_output=True,
        ).stdout
        return np.frombuffer(raw, dtype=np.float32), sr
    except (FileNotFoundError, subprocess.CalledProcessError):
        import soundfile as sf

        data, rate = sf.read(path, dtype="float32", always_2d=True)
        return data.mean(axis=1), rate


def speech_intervals(samples, sr, silence_db=None, hop=0.01, min_gap=0.15, min_speech=0.06):
    """List of (start, end) seconds where someone is talking (energy above a threshold)."""
    h = int(sr * hop)
    n = len(samples) // h
    if n == 0:
        return [], 0.0
    frames = samples[: n * h].reshape(n, h)
    rms = np.sqrt((frames ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    thr = silence_db if silence_db is not None else max(float(np.percentile(db, 95)) - 30.0, -60.0)
    active = db > thr
    spans, start = [], None
    for k, a in enumerate(active):
        if a and start is None:
            start = k
        elif not a and start is not None:
            spans.append([start * hop, k * hop])
            start = None
    if start is not None:
        spans.append([start * hop, n * hop])
    merged = []
    for s, e in spans:  # bridge tiny dips so one word is not split
        if merged and s - merged[-1][1] < min_gap:
            merged[-1][1] = e
        else:
            merged.append([s, e])
    return [(s, e) for s, e in merged if e - s >= min_speech], n * hop


def spread(words, t0, t1, speech):
    """Give each word a slot between t0 and t1. Slots follow word length and skip silences.
    Returns (list of (start, end), method)."""
    weights = [max(len(re.sub(r"\W", "", w)), 1) + 1 for w in words]
    inside = []
    for s, e in speech or []:
        s, e = max(s, t0), min(e, t1)
        if e - s > 0.02:
            inside.append((s, e))
    total = sum(e - s for s, e in inside)
    if total < 0.05 * max(len(words), 1):  # (almost) no speech found: plain even spacing
        step = (t1 - t0) / len(words)
        return [(t0 + k * step, t0 + (k + 1) * step) for k in range(len(words))], "even"

    def to_time(x):  # x in 0..total of speech seconds -> real time
        for s, e in inside:
            if x <= e - s + 1e-9:
                return s + x
            x -= e - s
        return inside[-1][1]

    cum, acc = [0.0], 0.0
    for wgt in weights:
        acc += wgt
        cum.append(acc)
    slots = []
    for k in range(len(words)):
        a, b = total * cum[k] / acc, total * cum[k + 1] / acc
        slots.append((to_time(a), to_time(b)))
    return slots, "silence"


# ----------------------------------------------------------------------- main


def read_captions(path: Path):
    words = []
    for tok in path.read_text(encoding="utf-8").split():
        if re.search(r"[\w]", tok, re.UNICODE):
            words.append(tok)
        elif words:  # lone punctuation like "-" sticks to the word before it
            words[-1] += tok
    return words


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Align Whisper words (words.json) to your own captions.txt.",
        epilog="captions.txt = the exact words you want on screen, in spoken order. Roman or Devanagari both work.",
    )
    ap.add_argument("--words", default="words.json", help="Whisper output from words.py (default: words.json)")
    ap.add_argument("--captions", default="captions.txt", help="your caption text (default: captions.txt)")
    ap.add_argument("--audio", default=None, help="the same voiceover; used to find silences for gaps (recommended)")
    ap.add_argument("-o", "--out", default="captions.words.json", help="output (default: captions.words.json)")
    ap.add_argument("--silence-db", type=float, default=None,
                    help="speech/silence threshold in dB (default: auto = 30 dB below the loud parts)")
    ap.add_argument("--min-word", type=float, default=0.08, help="shortest allowed word, seconds (default 0.08)")
    args = ap.parse_args()

    wh = json.loads(Path(args.words).read_text(encoding="utf-8"))
    caps = read_captions(Path(args.captions))
    if not caps:
        print("captions file has no words", file=sys.stderr)
        return 1
    if not wh:
        print("words.json is empty: Whisper heard nothing. Falling back to audio only.", file=sys.stderr)

    speech, audio_end = None, None
    if args.audio:
        samples, sr = load_audio(args.audio)
        speech, audio_end = speech_intervals(samples, sr, args.silence_db)
    if audio_end is None:
        audio_end = (wh[-1]["end"] + 0.4 * len(caps)) if wh else 0.4 * len(caps)

    pairs = align_tokens([skeleton(w) for w in caps], [skeleton(w["word"]) for w in wh])

    start = [None] * len(caps)
    end = [None] * len(caps)
    for ci, wi in pairs:
        t0, t1 = wh[wi[0]]["start"], wh[wi[-1]]["end"]
        if len(ci) == 1:
            start[ci[0]], end[ci[0]] = t0, t1
        else:  # two caption words on one Whisper word: split by length
            la, lb = len(caps[ci[0]]), len(caps[ci[1]])
            mid = t0 + (t1 - t0) * la / (la + lb)
            start[ci[0]], end[ci[0]], start[ci[1]], end[ci[1]] = t0, mid, mid, t1
    matched = [s is not None for s in start]

    # fill each run of unmatched words between two anchors
    gaps = []
    i = 0
    while i < len(caps):
        if matched[i]:
            i += 1
            continue
        j = i
        while j < len(caps) and not matched[j]:
            j += 1
        t0 = end[i - 1] if i > 0 else (speech[0][0] if speech else 0.0)
        t1 = start[j] if j < len(caps) else audio_end
        if j >= len(caps) and speech:  # trailing gap: stop at the last sound, not at file end
            t1 = max(min(t1, speech[-1][1]), t0 + 0.05)
        if t1 - t0 < 0.05 * (j - i):  # anchors are crowded: borrow a little room
            t1 = t0 + 0.05 * (j - i)
        slots, method = spread(caps[i:j], t0, t1, speech)
        for k, (a, b) in enumerate(slots):
            start[i + k], end[i + k] = a, b
        gaps.append((i, j, t0, t1, method))
        i = j

    # tidy: monotonic, no overlaps, minimum length
    out = []
    prev_end = 0.0
    for k, w in enumerate(caps):
        s = max(start[k], prev_end if k else 0.0)
        e = max(end[k], s + args.min_word)
        if k + 1 < len(caps) and matched[k + 1] and e > start[k + 1]:
            e = max(s + 0.02, min(e, start[k + 1]))
        out.append({"word": w, "start": round(s, 3), "end": round(e, 3)})
        prev_end = out[-1]["end"]
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    # report
    n_match, n_fill = sum(matched), len(caps) - sum(matched)
    print(f"Captions words : {len(caps)}")
    print(f"Whisper words  : {len(wh)}")
    print(f"Matched        : {n_match} ({100 * n_match / len(caps):.0f}%)  (time taken from Whisper)")
    print(f"Filled         : {n_fill} ({100 * n_fill / len(caps):.0f}%)  (time estimated from the gaps)")
    if gaps:
        print("\nFilled stretches (check these by ear):")
        for a, b, t0, t1, method in gaps:
            text = " ".join(caps[a:b])
            text = text if len(text) < 70 else text[:67] + "..."
            print(f"  words {a + 1}-{b}  {t0:6.2f}s to {t1:6.2f}s  [{method}]  \"{text}\"")
    print(f"\nWrote {args.out}")
    if n_fill > len(caps) * 0.5:
        print("Warning: over half the words were filled. Whisper may have heard something very different; "
              "check that captions.txt matches what is spoken.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
