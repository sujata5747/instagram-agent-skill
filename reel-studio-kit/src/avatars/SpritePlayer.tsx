// A deliberately BASIC sprite-sheet player for the "illustrated" and "pixel" avatars.
//   1. slices the sheet by its grid (5 columns x 4 rows = 20 poses)
//   2. removes the green background (chroma key, once, in the browser)
//   3. shows one pose at a time, switching by a simple list of cues
//   4. mouth = a dark open/close shape on the face, driven by loudness (+ a tiny squash)
//   5. optional blink
// There is NO automatic pose choice and no motion engine here. You (or Claude) write the cue list.
import React, { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { SheetConfig } from "./sheets";

export type PoseCue = { at: number; pose: number | string };

type Props = {
  sheet: SheetConfig;
  /** Poses over time: [{ at: 0, pose: "idle" }, { at: 3.2, pose: 7 }]. `at` is in seconds. */
  cues: PoseCue[];
  /** 0 closed .. 1 open. Use useMouth(). */
  mouth: number;
  size?: number;
  /** Show the grid cell number on top (to pick poses). */
  debugCell?: boolean;
  style?: React.CSSProperties;
};

const keyCache = new Map<string, Promise<string>>();

/** Loads the sheet and turns the green background transparent. Result is cached per sheet. */
const keySheet = (src: string, key: string): Promise<string> => {
  const id = `${src}|${key}`;
  const hit = keyCache.get(id);
  if (hit) return hit;
  const k = parseInt(key.slice(1), 16);
  const kr = (k >> 16) & 255;
  const kg = (k >> 8) & 255;
  const kb = k & 255;
  const p = new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];
        // How "green-screen" is this pixel? Distance of its green dominance from the key's.
        const dom = g - Math.max(r, b);
        const keyDom = kg - Math.max(kr, kb);
        if (g > 90 && dom > keyDom * 0.35) {
          const a = dom > keyDom * 0.75 ? 0 : (keyDom * 0.75 - dom) / (keyDom * 0.4);
          px[i + 3] = Math.round(255 * Math.min(1, Math.max(0, a)));
          px[i + 1] = Math.min(g, Math.max(r, b) + 10); // despill: no green fringe
        }
      }
      ctx.putImageData(data, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error(`Cannot load sprite sheet ${src}`));
    img.src = staticFile(src);
  });
  keyCache.set(id, p);
  return p;
};

export const SpritePlayer: React.FC<Props> = ({ sheet, cues, mouth, size = 340, debugCell = false, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [url, setUrl] = useState<string | null>(null);
  const [handle] = useState(() => delayRender(`sprite sheet ${sheet.src}`));

  useEffect(() => {
    keySheet(sheet.src, sheet.key ?? "#00FF00")
      .then((u) => {
        setUrl(u);
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        continueRender(handle);
      });
  }, [sheet.src, sheet.key, handle]);

  const t = frame / fps;
  let cue: PoseCue = cues[0] ?? { at: 0, pose: 0 };
  for (const c of cues) if (c.at <= t && c.at >= cue.at) cue = c;
  const index = typeof cue.pose === "number" ? cue.pose : Math.max(0, sheet.poseNames?.indexOf(cue.pose) ?? 0);
  const col = index % sheet.cols;
  const row = Math.floor(index / sheet.cols) % sheet.rows;

  const open = Math.max(0, Math.min(1, mouth));
  const bob = Math.sin(frame / 14) * 5;
  const squash = 1 + 0.025 * open;
  const m = sheet.mouth;
  const blinkP = (frame + 40) % 110;
  const blinking = !!sheet.blink && blinkP < 5;

  return (
    <div
      data-el="avatar"
      data-kind="avatar"
      style={{ width: size, height: size, position: "relative", transform: `translateY(${bob}px) scaleY(${squash})`, transformOrigin: "50% 100%", ...style }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: url ? `url(${url})` : undefined,
          backgroundSize: `${sheet.cols * size}px ${sheet.rows * size}px`,
          backgroundPosition: `${-col * size}px ${-row * size}px`,
          imageRendering: sheet.pixelated ? "pixelated" : "auto",
        }}
      />
      {open > 0.1 ? (
        <div
          style={{
            position: "absolute",
            left: (m.x - m.w / 2) * size,
            top: (m.y - (m.h * open) / 2) * size,
            width: m.w * size,
            height: Math.max(3, m.h * size * open),
            borderRadius: sheet.pixelated ? 0 : "50%",
            background: m.color ?? "#2A1417",
          }}
        />
      ) : null}
      {blinking && sheet.blink
        ? sheet.blink.eyes.map((e, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: (e.x - sheet.blink!.w / 2) * size,
                top: (e.y - sheet.blink!.h / 2) * size,
                width: sheet.blink!.w * size,
                height: sheet.blink!.h * size,
                background: sheet.blink!.lidColor,
                borderBottom: `${Math.max(3, size * 0.01)}px solid ${sheet.blink!.lineColor}`,
                borderRadius: sheet.pixelated ? 0 : "50%",
              }}
            />
          ))
        : null}
      {debugCell ? (
        <div style={{ position: "absolute", left: 6, top: 6, background: "#000a", color: "#fff", fontSize: 24, padding: "2px 8px", fontFamily: "monospace" }}>
          cell {index}
        </div>
      ) : null}
    </div>
  );
};
