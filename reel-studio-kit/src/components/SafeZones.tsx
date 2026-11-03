import React from "react";
import { AbsoluteFill } from "remotion";
import { HEIGHT, SAFE, WIDTH } from "../layout";

const zone: React.CSSProperties = {
  position: "absolute",
  background: "rgba(255, 40, 40, 0.28)",
  color: "#fff",
  fontFamily: "monospace",
  fontSize: 28,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  textShadow: "0 1px 3px rgba(0,0,0,0.6)",
};

/** Debug overlay: red = Instagram UI may cover this. Green outline = safe box. Never in the final render. */
export const SafeZones: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ ...zone, left: 0, top: 0, width: WIDTH, height: SAFE.top }}>top {SAFE.top}px · IG header</div>
    <div style={{ ...zone, left: 0, top: HEIGHT - SAFE.bottom, width: WIDTH, height: SAFE.bottom }}>
      bottom {SAFE.bottom}px · username, caption, audio
    </div>
    <div style={{ ...zone, right: 0, top: SAFE.top, width: SAFE.right, height: HEIGHT - SAFE.top - SAFE.bottom, writingMode: "vertical-rl" }}>
      right {SAFE.right}px · like, comment, share
    </div>
    <div
      style={{
        position: "absolute",
        left: SAFE.left,
        top: SAFE.top,
        width: WIDTH - SAFE.left - SAFE.right,
        height: HEIGHT - SAFE.top - SAFE.bottom,
        border: "4px dashed rgba(20, 200, 90, 0.9)",
        boxSizing: "border-box",
      }}
    />
  </AbsoluteFill>
);
