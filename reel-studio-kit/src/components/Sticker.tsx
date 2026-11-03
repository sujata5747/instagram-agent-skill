import React from "react";
import { useBrand } from "../brand-context";
import { usePop } from "./pop";

type Props = { text: string; at?: number; rotate?: number; style?: React.CSSProperties };

/** Tilted badge. It is allowed to overlap a card corner (data-overlap-ok="card"). */
export const Sticker: React.FC<Props> = ({ text, at = 0, rotate = -8, style }) => {
  const b = useBrand();
  const pop = usePop(at);
  return (
    <div
      data-el="sticker"
      data-kind="content"
      data-overlap-ok="card"
      style={{ ...style, ...pop.style, transform: `${pop.style.transform} rotate(${rotate * pop.progress}deg)` }}
    >
      <div
        style={{
          background: b.colors.accent2,
          color: "#FFFFFF",
          fontFamily: b.fontFamily,
          fontWeight: 800,
          fontSize: 40,
          padding: "14px 28px",
          borderRadius: Math.max(8, b.radius),
          boxShadow: b.boxShadow,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </div>
  );
};
