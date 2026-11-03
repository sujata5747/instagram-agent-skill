// Karaoke captions, from the free caption-sync-kit (MIT) and wired to the brand.
// The word being spoken is solid, words still to come are faded, keywords get the accent colour.
// Feed it public/reels/<id>/captions.words.json (made by `npm run sync -- <id>`).
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useBrand } from "../brand-context";
import type { Word } from "../timing";

type Props = {
  words: Word[];
  /** Words per chunk (2-5). Default 4. */
  perChunk?: number;
  /** Words (case and punctuation ignored) shown in the highlight colour. */
  keywords?: string[];
  size?: number;
  /** Keep the last chunk on screen this long after its last word (seconds). */
  holdSec?: number;
  style?: React.CSSProperties;
};

const clean = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export const Karaoke: React.FC<Props> = ({ words, perChunk = 4, keywords = [], size = 58, holdSec = 0.35, style }) => {
  const b = useBrand();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const n = Math.min(5, Math.max(2, Math.round(perChunk)));
  if (!words.length) return null;

  let current = -1;
  for (let i = 0; i < words.length; i++) {
    if (words[i].start <= t) current = i;
    else break;
  }
  if (current < 0) return null;

  const chunkStart = Math.floor(current / n) * n;
  const chunk = words.slice(chunkStart, chunkStart + n);
  const last = chunk[chunk.length - 1];
  if (t > last.end + holdSec && chunkStart + n >= words.length) return null;

  const keys = new Set(keywords.map(clean));

  return (
    <div data-el="captions" data-kind="caption" style={{ display: "flex", justifyContent: "center", ...style }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 0.3em",
          background: b.colors.surface,
          borderRadius: b.radius,
          boxShadow: b.boxShadow,
          padding: "0.35em 0.7em",
          fontFamily: b.fontFamily,
          fontSize: size,
          fontWeight: 800,
          lineHeight: 1.25,
        }}
      >
        {chunk.map((w, i) => {
          const idx = chunkStart + i;
          const spoken = idx <= current;
          const isKey = keys.has(clean(w.word));
          return (
            <span key={idx} style={{ color: isKey ? b.colors.accent : b.colors.text, opacity: spoken ? 1 : 0.3 }}>
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
