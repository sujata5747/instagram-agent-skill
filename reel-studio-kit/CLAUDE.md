# Reel Studio Kit

This folder makes vertical (9:16) social reels end to end. The user types one line, for example:

- `reel banao: 3 sleep mistakes that ruin your mornings`
- `make a reel: how a heat pump works`

When you see a request like that, **load and follow `.claude/skills/reels/SKILL.md`**. It holds the full workflow. Do not skip its steps or its approval gates.

## Pipeline in one glance

```
research + script  ->  USER APPROVES  ->  voice  ->  caption sync  ->  scenes  ->  render  ->  self-check  ->  caption + hashtags
projects/<id>/        (stop here!)       vo.wav     captions.words.json  src/reels/<id>/  out/<id>.mp4   out/<id>/check/
```

## Commands (all from this folder)

| What | Command |
|---|---|
| Install | `npm install` |
| Typecheck | `npm run typecheck` |
| Preview in browser | `npm run studio` |
| New reel scaffold | `npm run new -- <id>` |
| Voice (OpenAI) | `npm run voice -- <id> --provider openai` |
| Voice (ElevenLabs) | `npm run voice -- <id> --provider elevenlabs` |
| Voice (own recording) | `npm run voice -- <id> --provider own --file <path>` |
| Caption sync + mouth data | `npm run sync -- <id> --lang en` (or `hi`, `auto`) |
| Self-check (frames + contact sheet) | `npm run check -- <id>` |
| Render | `npm run render -- <id>` -> `out/<id>.mp4` |
| Demo (no keys) | `npm run demo` |

One-time for caption sync: `npm run setup:captions` (Python 3.11+ and ffmpeg needed).

## Where things live

- `src/brand.ts`: the brand block (colours, font, corner radius, shadow, handle). Everything re-skins from here. `src/presets.ts` has 3 ready looks.
- `src/layout.ts`: 1080x1920, 30 fps, Instagram safe zones. Keep text, numbers and faces inside `SAFE_BOX`.
- `src/components/`: Title, Card + Line, BigNumber, Sticker, EndCard, Karaoke (captions), SceneBlock, ReelFrame.
- `src/avatars/`: `FlatMascot` (code-drawn SVG), `SpritePlayer` (illustrated and pixel sheets), `sheets.ts` (sheet settings), `useMouth.ts`.
- `src/reels/<id>/Reel.tsx`: one reel. `src/reels/demo/Reel.tsx` is the worked example. `src/reels/registry.ts` lists them.
- `projects/<id>/`: `script.md`, `voice.txt` (exact words spoken), `captions.txt` (exact words on screen, same order).
- `public/reels/<id>/`: `vo.wav`, `captions.words.json`, `mouth.json` (generated).
- `sprites/PROMPT.md`: the prompt template for making a sprite sheet of the user's own character.

## Ground rules

- Never put API keys in files. Keys come from the environment or `.env` (see `.env.example`). Never print them.
- Never skip the script approval gate. Research and write the script, show it, wait for a yes.
- Facts need sources. No number or claim goes into the script without a source you actually opened; otherwise cut it or say it is an opinion.
- Never render the final video without running the self-check (`npm run check`) and LOOKING at the contact sheet.
- Do not restyle the brand unless asked. Use `src/brand.ts` values, do not hard-code colours inside reels.
- Keep reels under 60 s. Never ask the user to install things you can check for first (`ffmpeg -version`, `node -v`).
- If Remotion's browser fails to start, set `BROWSER_EXECUTABLE` (macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`). The render and check scripts already retry with it.
- Sprite sheets are 5 columns x 4 rows = 20 poses (names in `src/avatars/sheets.ts`, `POSE_NAMES`).
- The sprite avatars are intentionally basic: you write the pose list by hand. Do not build an automatic pose engine unless asked.
