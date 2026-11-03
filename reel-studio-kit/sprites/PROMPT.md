# Sprite sheet prompt (illustrated and pixel avatars)

Fill in the three `[BRACKETS]`, paste the prompt into any image generator you like, and keep the best result as `public/avatars/<name>/sheet.png`. **One sheet = one style.** Make a second sheet for a second look.

Tips before you start:

- Make ONE character you like first (a single image), then use it as the reference image for the sheet.
- The image is 5 columns x 4 rows, so it is wider than tall. Any size is fine as long as every cell is square and it divides evenly (for example 2000 x 1600, cells of 400 x 400).
- Generators often ignore exact sizes. If the grid comes out uneven, ask again, or crop and resize the sheet yourself so every cell is the same size.
- Open the result in the Studio (`npm run studio`, composition `Demo-Illustrated`) to see it working.

---

## The prompt

```
Create a character sprite sheet: exactly 4 rows x 5 columns = 20 poses of the SAME character, on one image.

CHARACTER: [describe your character: who they are, hair, clothes, colours, age, personality]
STYLE: [pick one and keep it for the whole sheet: "clean flat illustration, soft shading" OR "16-bit pixel art, crisp square pixels, no blur, no anti-aliasing"]
BRAND COLOURS: [your 2-3 main colours, used for clothes and small details]

STRICT LAYOUT RULES
- 5 equal columns and 4 equal rows, every cell the same square size (for example 2000 x 1600, cells of 400 x 400). No grid lines, no borders, no labels, no numbers, no text anywhere.
- Background: one flat pure green (#00FF00) in every cell and between them. No gradient, no shadow on the ground, no green anywhere on the character.
- The character is the same size in every cell. THE HEAD IS IN EXACTLY THE SAME POSITION AND SIZE IN EVERY CELL (only the body, arms and hands change). The camera never moves.
- Nothing may touch or cross a cell edge. Leave at least 8% empty green margin on every side of every cell. Hands and arms included.
- Mouth CLOSED in every pose (a simple closed mouth, small smile or neutral line). The mouth is animated by software later.
- Eyes open in every pose, looking at the viewer (or slightly aside only where the pose says so).
- Give the whole character a clean thick WHITE sticker outline (about 3% of the character height), like a die-cut sticker. The outline must be fully visible and not merge with the green.
- Same character, same outfit, same proportions, same colours, same line style, in all 20 cells.

THE 20 POSES (read left to right, top to bottom)
Row 1: 1 idle, arms relaxed | 2 palms open, explaining | 3 finger up | 4 pointing right | 5 pointing left
Row 2: 6 pointing down | 7 holding up 1 finger | 8 holding up 2 fingers | 9 holding up 3 fingers | 10 open hand, 5 fingers
Row 3: 11 thumbs up | 12 OK sign | 13 hand on chin, thinking | 14 shrug, palms up | 15 waving
Row 4: 16 holding a phone screen toward the viewer | 17 arms crossed | 18 presenting with palm | 19 excited, rubbing hands | 20 heart hands

Output only the finished sheet image.
```

## After you have the sheet

1. Save it as `public/avatars/my-character/sheet.png`.
2. Open `src/avatars/sheets.ts`. Copy the `illustrated` (or `pixel`) entry, set `src: "avatars/my-character/sheet.png"`, and adjust:
   - `mouth: { x, y, w, h }`: where the mouth is inside one cell, as fractions from 0 to 1 (x = 0.5 is the middle). The head is at the same place in every cell, so one value works for all poses.
   - `blink` (optional): eye positions and the skin colour for the eyelids. Delete the `blink` line to skip blinking.
   - `pixelated: true` for pixel art so it stays crisp.
   - `poseNames`: the 20 names in the order of your sheet (idle, explain, finger-up, point-right, point-left, point-down, one, two, three, five, thumbs-up, ok, thinking, shrug, wave, phone, arms-crossed, present, rubbing-hands, heart-hands), so you can write `"point-right"` instead of `3`.
3. Point the avatar at your entry (in `src/avatars/Avatar.tsx`, change `SHEETS.illustrated` to `SHEETS.myCharacter`) or simply overwrite the sample `sheet.png` files.
4. In your reel, write the pose list: `{ at: 4.2, pose: "finger-up" }` means "from second 4.2, show that pose".
   Tip: add `debugCell` to `<SpritePlayer>` to print the cell number on screen.
5. If you see a green edge, the sheet's green is not pure (#00FF00). Re-generate, or set `key` in the sheet entry to the actual green.

The sprite player is deliberately basic (slice, key green, show a pose, open and close a mouth). Automatic poses from the script, code-drawn mouth shapes and calm motion are part of the pro avatar engine coming in Animo (getanimo.io).
