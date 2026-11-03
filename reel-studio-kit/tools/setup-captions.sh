#!/usr/bin/env bash
# One-time setup for free, local caption sync (faster-whisper). Creates tools/.venv.
set -e
cd "$(dirname "$0")"
PY=""
for c in python3.12 python3.11 python3.13; do command -v $c >/dev/null 2>&1 && PY=$c && break; done
if [ -z "$PY" ]; then echo "Need Python 3.11, 3.12 or 3.13. Mac: brew install python@3.12"; exit 1; fi
command -v ffmpeg >/dev/null 2>&1 || { echo "Need ffmpeg. Mac: brew install ffmpeg"; exit 1; }
$PY -m venv .venv
./.venv/bin/pip install --quiet --upgrade pip
./.venv/bin/pip install --quiet -r captions/requirements.txt
echo "Done. The first 'npm run sync' downloads the Whisper model once (small = about 480 MB)."
