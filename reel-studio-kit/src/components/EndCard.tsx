import React from "react";
import { useBrand } from "../brand-context";
import { usePop } from "./pop";

type Props = {
  /** The word people comment to get the thing, e.g. "KIT". */
  keyword: string;
  /** Short line above the keyword, e.g. "Want the kit?" */
  lead?: string;
  /** Small line under it, e.g. "I will send it to you". */
  sub?: string;
  at?: number;
};

/** Closing card: lead line, big comment-keyword pill, handle. Pops on the word you pass as `at`. */
export const EndCard: React.FC<Props> = ({ keyword, lead = "Want it?", sub = "I will send it to you", at = 0 }) => {
  const b = useBrand();
  const card = usePop(at);
  const pill = usePop(at + 8);
  // Long keywords shrink so the pill always fits the card.
  const pillSize = Math.max(56, Math.min(140, Math.floor(690 / (keyword.length * 0.85))));
  return (
    <div
      data-el="endcard"
      data-kind="content"
      style={{
        ...card.style,
        background: b.colors.surface,
        color: b.colors.text,
        fontFamily: b.fontFamily,
        borderRadius: b.radius,
        boxShadow: b.boxShadow,
        border: b.shadow ? "none" : `2px solid ${b.colors.text}22`,
        padding: "56px 48px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 56, fontWeight: 700, opacity: 0.75 }}>{lead}</div>
      <div style={{ fontSize: 44, fontWeight: 600, margin: "28px 0 12px", opacity: 0.6 }}>Comment</div>
      <div style={{ ...pill.style, display: "inline-block" }}>
        <div
          style={{
            background: b.colors.accent,
            color: b.colors.bg,
            fontSize: pillSize,
            fontWeight: 800,
            lineHeight: 1,
            padding: "22px 54px",
            borderRadius: Math.max(12, b.radius),
            letterSpacing: 2,
          }}
        >
          {keyword}
        </div>
      </div>
      <div style={{ fontSize: 44, fontWeight: 600, marginTop: 32, opacity: 0.75 }}>{sub}</div>
      <div style={{ fontSize: 40, fontWeight: 800, marginTop: 20, color: b.colors.accent }}>{b.handle}</div>
    </div>
  );
};
