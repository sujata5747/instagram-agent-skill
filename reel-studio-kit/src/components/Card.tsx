import React from "react";
import { useBrand } from "../brand-context";
import { usePop } from "./pop";

type Props = { at?: number; children: React.ReactNode; style?: React.CSSProperties };

export const Card: React.FC<Props> = ({ at = 0, children, style }) => {
  const b = useBrand();
  const pop = usePop(at);
  return (
    <div
      data-el="card"
      data-kind="content"
      style={{
        ...pop.style,
        background: b.colors.surface,
        color: b.colors.text,
        fontFamily: b.fontFamily,
        borderRadius: b.radius,
        boxShadow: b.boxShadow,
        border: b.shadow ? "none" : `2px solid ${b.colors.text}22`,
        padding: 48,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** One line inside a Card that pops in on its own word. */
export const Line: React.FC<{ at: number; children: React.ReactNode; first?: boolean }> = ({ at, children, first }) => {
  const b = useBrand();
  const { style } = usePop(at);
  return (
    <div
      style={{
        ...style,
        transformOrigin: "left center",
        marginTop: first ? 0 : 28,
        paddingTop: first ? 0 : 28,
        borderTop: first ? "none" : `3px solid ${b.colors.text}14`,
        fontSize: 52,
        fontWeight: 700,
        lineHeight: 1.15,
      }}
    >
      {children}
    </div>
  );
};
