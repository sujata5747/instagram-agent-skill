#!/usr/bin/env python3
"""words.py - free, local word timestamps for your voiceover.

Runs faster-whisper on your own computer (no API key, no upload, no cost) and
writes words.json: a list of {"word", "start", "end"} with times in seconds.

Examples
  python words.py vo.wav                      # auto-detect language, model "small"
  python words.py vo.wav --lang hi            # Hindi / Hinglish voiceover
  python words.py vo.wav --lang en --model base
  python words.py vo.wav --lang hi --prompt-file captions.txt   # helps Whisper spell your words

The first run downloads the model once (small = about 480 MB). After that it
works offline.
"""
import argparse
import json
import sys
import time
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Audio in, words.json out (word-level timestamps, local faster-whisper).",
        epilog="Output format: [{\"word\": \"Hello\", \"start\": 0.32, \"end\": 0.61}, ...] in seconds.",
    )
    p.add_argument("audio", help="voiceover file (wav, mp3, m4a, mp4... anything ffmpeg can read)")
    p.add_argument("-o", "--out", default="words.json", help="output file (default: words.json)")
    p.add_argument("--model", default="small",
                   help="tiny | base | small | medium | large-v3 (default: small; bigger = slower but better)")
    p.add_argument("--lang", default="auto", choices=["auto", "hi", "en"],
                   help="spoken language: hi, en, or auto-detect (default: auto)")
    p.add_argument("--device", default="cpu", help="cpu (default) or cuda if you have an NVIDIA GPU")
    p.add_argument("--compute-type", default=None,
                   help="int8 on CPU (default), float16 on cuda")
    p.add_argument("--prompt-file", default=None,
                   help="optional text file (e.g. your captions.txt). Shown to Whisper as a hint so it "
                        "spells words the way you write them. Can help or hurt, so compare both.")
    p.add_argument("--no-vad", action="store_true",
                   help="do not skip silence before transcribing (default skips it)")
    return p


def main() -> int:
    args = build_parser().parse_args()
    audio = Path(args.audio)
    if not audio.exists():
        print(f"Cannot find audio file: {audio}", file=sys.stderr)
        return 1

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("faster-whisper is not installed. Run: pip install -r requirements.txt", file=sys.stderr)
        return 1

    compute = args.compute_type or ("int8" if args.device == "cpu" else "float16")
    print(f"Loading model '{args.model}' on {args.device} ({compute})...")
    model = WhisperModel(args.model, device=args.device, compute_type=compute)

    prompt = None
    if args.prompt_file:
        prompt = " ".join(Path(args.prompt_file).read_text(encoding="utf-8").split())[:600]

    print(f"Transcribing {audio.name} ...")
    t0 = time.time()
    segments, info = model.transcribe(
        str(audio),
        language=None if args.lang == "auto" else args.lang,
        word_timestamps=True,
        vad_filter=not args.no_vad,
        initial_prompt=prompt,
        condition_on_previous_text=False,
    )

    words = []
    for seg in segments:  # generator: the work happens here
        for w in seg.words or []:
            text = w.word.strip()
            if text:
                words.append({"word": text, "start": round(float(w.start), 3), "end": round(float(w.end), 3)})

    Path(args.out).write_text(json.dumps(words, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Language: {info.language} (confidence {info.language_probability:.2f})")
    print(f"Wrote {len(words)} words to {args.out} in {time.time() - t0:.1f}s")
    if words:
        print(f"Speech runs from {words[0]['start']:.2f}s to {words[-1]['end']:.2f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
