# Reel Studio Kit

A free Claude Code folder that makes **vertical reels** (Instagram, Shorts, TikTok). You type one line. Claude Code writes the script, makes the voice, syncs the captions to every word, builds the scenes, renders the video, **checks its own frames**, and writes your caption and hashtags.

Free, MIT licence.

Hinglish mein: ek line likho, baaki sab Claude Code karega. Script, awaaz, scenes, render. Aur dikhane se pehle har frame khud check karta hai.

```
reel banao: 3 sleep mistakes that ruin your mornings
```

## What you get

- **Any kind of reel**: explainer, animated character, pixel art. Scenes with titles, cards, big numbers, stickers and an end card.
- **A real workflow**: research and script (hook, beats, twist, CTA, sources) -> you approve -> voice -> word-synced captions -> scenes -> render -> self-check -> caption and hashtags.
- **Your voice**: OpenAI voice, ElevenLabs voice, or your own recording.
- **Captions that sync on every word** (free, local Whisper, no upload).
- **Three avatar styles**: flat mascot, illustrated, pixel. Mouth moves with the voice.
- **Your brand**: colours, font, corner radius, handle in one file. Three neutral presets.
- **Hook and pacing rules** built in: hook in 3 s, new scene every 4-8 s, something moves every ~2 s, under 60 s, comment-keyword CTA.
- **Self-check**: renders frames with Instagram's no-go zones drawn on, measures every element (overflow, safe zone, overlaps, empty scenes) and builds a contact sheet that Claude looks at before it shows you anything.

## Install

You need [Node.js](https://nodejs.org) 18+, [ffmpeg](https://ffmpeg.org) and [Claude Code](https://claude.com/claude-code).

```bash
cd reel-studio-kit
npm install
npm run typecheck
```

Try the demo first. No API key needed:

```bash
npm run demo          # renders out/Demo.mp4 (15 s, placeholder hum instead of a voice)
npm run studio        # live preview in the browser
```

The first render downloads a headless browser and Google fonts, so it needs internet once. If Remotion's browser fails to start, tell it to use your Chrome:

```bash
export BROWSER_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

For caption sync (once): `npm run setup:captions` (needs Python 3.11, 3.12 or 3.13). The first sync downloads the Whisper model once (about 480 MB).

## Make a reel (one line)

Open Claude Code in this folder (`claude`) and type:

```
reel banao: <your topic>
```

or `make a reel: <your topic>`. Claude follows `.claude/skills/reels/SKILL.md`:

1. Researches and writes the script. **Stops and asks you to approve.**
2. Makes the voice (asks which of the three).
3. Syncs captions to the voice, word by word.
4. Builds the scenes so cuts and pop-ups land on spoken words.
5. Renders `out/<id>.mp4`.
6. Self-check: contact sheet of frames, fixes problems, re-renders.
7. Gives you the post caption and hashtags.

Want a style? Say it in the line: `reel banao: topic, pixel avatar, dark preset, handle @me`.

### Commands (Claude runs these for you, you can too)

| What | Command |
|---|---|
| New reel scaffold | `npm run new -- my-reel` |
| Voice | `npm run voice -- my-reel --provider openai` / `elevenlabs` / `own` |
| Caption sync + mouth data | `npm run sync -- my-reel --lang en` (`hi` for Hindi/Hinglish) |
| Self-check | `npm run check -- my-reel` |
| Render | `npm run render -- my-reel` |

## Voice

Put the words to be spoken in `projects/<id>/voice.txt`. Then pick one:

**a) OpenAI** (`gpt-4o-mini-tts`, or `--model gpt-audio`)

```bash
cp .env.example .env      # add OPENAI_API_KEY=... (the file is never committed or zipped)
npm run voice -- my-reel --provider openai --voice cedar --style "warm, quick, friendly"
```

**b) ElevenLabs**

```bash
# in .env: ELEVENLABS_API_KEY=... and ELEVENLABS_VOICE_ID=<an id from your voice library>
npm run voice -- my-reel --provider elevenlabs
```

**c) Your own recording** (apni awaaz)

```bash
npm run voice -- my-reel --provider own --file ~/Downloads/recording.m4a   # any format, cleaned to wav
# or just drop public/reels/my-reel/vo.wav yourself
```

No keys are stored in any file in this kit. Keys are read from your environment or your private `.env`.

Quick real-voice test with the Mac's built-in voice (free):

```bash
say -o /tmp/vo.aiff -f projects/demo/voice.txt
npm run voice -- demo --provider own --file /tmp/vo.aiff
npm run sync -- demo --lang en      # redo word timings from the real audio
npm run demo
```

## Captions that sync

`npm run sync -- <id>` does two things, locally and free:

1. Whisper listens to your voice and gives the time of each word.
2. `captions.txt` (your exact words) is aligned to those times, so spelling is always yours. Where Whisper missed a stretch, your words are spread over the real speech and silences are skipped.

It prints how many words matched. Under 70 percent usually means `captions.txt` does not match what was spoken. Built on the free caption-sync-kit code (MIT, same author).

## Change the brand and style

Open `src/brand.ts`:

```ts
export const brand: Brand = {
  colors: { bg: "#F5F5F2", surface: "#FFFFFF", text: "#14161A", accent: "#2B6CF6", accent2: "#12B886" },
  font: "Inter",      // Inter, SpaceGrotesk, Nunito, or add your own in src/fonts.ts
  radius: 32,         // 0 = sharp corners
  shadow: true,
  handle: "@yourhandle",
};
```

Use 6-digit hex colours. Everything (titles, cards, captions, end card, flat mascot) follows. `src/presets.ts` has `cleanLight`, `boldDark`, `softPastel`; copy one into `brand.ts`, or render a preset directly: `npx remotion render Demo-BoldDark`.

Instagram safe zones live in `src/layout.ts`. To see them: `npm run check -- <id>` draws them in red on every frame.

## Avatars

Pick one per reel with the `avatar` prop (`flat`, `illustrated`, `pixel`, `none`). Try them: `npx remotion render Demo`, `Demo-Illustrated`, `Demo-Pixel`.

| Style | What it is | Your part |
|---|---|---|
| **flat** | A generic code-drawn robot (SVG). Mouth opens with the voice, blinks, bobs. Uses your brand colours. | Nothing. To make it yours, edit the shapes in `src/avatars/FlatMascot.tsx`. |
| **illustrated** | Your character on a 5 x 4 sprite sheet (20 poses: 5 columns, 4 rows). | Make the sheet with `sprites/PROMPT.md`. |
| **pixel** | Same, in pixel art. | Same, with the pixel style. |

### Add your own avatar

1. Open `sprites/PROMPT.md`, fill in your character, style and colours, run it in any image generator. One sheet = one style.
2. Save as `public/avatars/my-character/sheet.png`.
3. Add an entry in `src/avatars/sheets.ts` (where the mouth is, optional blink, pose names).
4. In your reel, write the pose list: `{ at: 4.2, pose: "finger-up" }` = "from second 4.2 show this pose".

The bundled sprite sheets are placeholders (plain coloured figures) so you can see the player work. The player is **intentionally basic**: it slices the sheet, removes the green, shows the pose you list, and opens or closes a simple mouth shape from the loudness.

> **Pro avatar engine** (auto poses, code-drawn mouth shapes, calm motion) is coming in **Animo (getanimo.io)**.

## Folder map

```
CLAUDE.md                     tells Claude Code what this folder is
.claude/skills/reels/         the full reel workflow (the "reel banao" skill)
src/brand.ts, presets.ts      your look
src/layout.ts                 canvas + safe zones
src/components/               Title, Card, BigNumber, Sticker, EndCard, Karaoke captions...
src/avatars/                  flat mascot + sprite player
src/reels/                    one folder per reel (demo included)
projects/<id>/                script, voice text, caption text
public/reels/<id>/            voice + word timings (generated)
sprites/PROMPT.md             sprite sheet prompt template
tools/                        voice, sync, check, render scripts
```

## Licences

- This kit: **MIT** (see `LICENSE`). Use it, change it, sell videos made with it.
- **Remotion** (the video engine, installed by `npm install`) has its own licence: free for individuals and small companies, a paid company licence for larger ones. Read it at https://www.remotion.dev/license before you use this commercially.
- Fonts are Google Fonts (Inter, Space Grotesk, Nunito), open source (OFL).
- Caption sync code (`tools/captions/`) is from the caption-sync-kit (MIT). It installs `faster-whisper` (MIT); the Whisper model weights it downloads are MIT.
- You own your scripts and videos. Check the terms of the voice service you choose (OpenAI, ElevenLabs) for commercial use.
- Facts in your reels are your responsibility. The skill asks Claude to cite sources, always read them.
