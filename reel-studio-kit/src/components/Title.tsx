import React from "react";
import { useBrand } from "../brand-context";
import { usePop } from "./pop";

type Props = {
  text: string;
  /** Part of `text` to colour with the accent, e.g. "3 seconds". */
  highlight?: string;
  at?: number;
  size?: number;
  showHandle?: boolean;
};

export const Title: React.FC<Props> = ({ text, highlight, at = 0, size = 96, showHandle = true }) => {
  const b = useBrand();
  const { style } = usePop(at);
  const parts = highlight && text.includes(highlight) ? text.split(highlight) : [text];
  return (
    <div data-el="title" data-kind="content" style={{ ...style, transformOrigin: "left center", fontFamily: b.fontFamily, color: b.colors.text }}>
      {showHandle ? <div style={{ fontSize: 34, fontWeight: 600, opacity: 0.6, marginBottom: 12 }}>{b.handle}</div> : null}
      <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>
        {parts.length === 2 ? (
          <>
            {parts[0]}
            <span style={{ color: b.colors.accent }}>{highlight}</span>
            {parts[1]}
          </>
        ) : (
          text
        )}
      </div>
    </div>
  );
};
