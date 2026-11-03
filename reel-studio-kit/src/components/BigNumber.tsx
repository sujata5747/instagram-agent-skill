import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { useBrand } from "../brand-context";
import { usePop } from "./pop";

type Props = {
  to: number;
  from?: number;
  at?: number;
  /** How many frames the count-up takes. */
  countFrames?: number;
  prefix?: string;
  suffix?: string;
  label?: React.ReactNode;
  size?: number;
  /** "row" = label next to the number, "stack" = label below. */
  layout?: "row" | "stack";
  /** Set false when it sits inside a Card (the Card is the checked element). */
  tracked?: boolean;
};

export const BigNumber: React.FC<Props> = ({ to, from = 0, at = 0, countFrames = 20, prefix = "", suffix = "", label, size = 260, layout = "row", tracked = true }) => {
  const b = useBrand();
  const frame = useCurrentFrame();
  const { style } = usePop(at);
  const value = interpolate(frame - at, [0, countFrames], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const track = tracked ? { "data-el": "number", "data-kind": "content" } : {};
  return (
    <div
      {...track}
      style={{
        ...style,
        transformOrigin: "left center",
        fontFamily: b.fontFamily,
        display: "flex",
        flexDirection: layout === "row" ? "row" : "column",
        alignItems: layout === "row" ? "flex-end" : "flex-start",
        gap: layout === "row" ? 36 : 12,
      }}
    >
      <div style={{ fontSize: size, fontWeight: 800, lineHeight: 0.9, color: b.colors.accent, fontVariantNumeric: "tabular-nums" }}>
        {prefix}
        {Math.round(value).toLocaleString("en-US")}
        {suffix}
      </div>
      {label ? (
        <div style={{ fontSize: 48, fontWeight: 700, lineHeight: 1.1, color: b.colors.text, paddingBottom: layout === "row" ? 24 : 0 }}>{label}</div>
      ) : null}
    </div>
  );
};
