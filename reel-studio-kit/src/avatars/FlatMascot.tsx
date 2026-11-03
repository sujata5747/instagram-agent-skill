// A simple code-drawn mascot (a friendly round robot) in plain SVG.
// Mouth opens from the voice loudness, eyes blink, body bobs. Colours come from your brand.
// Replace the shapes with your own SVG to get your own flat character: keep the
// `mouth` (0-1) and `blink` (0-1) variables where they are and the rest of the kit keeps working.
import React from "react";
import { useCurrentFrame } from "remotion";
import { useBrand } from "../brand-context";

type Props = {
  /** 0 closed .. 1 wide open. Use useMouth(). */
  mouth: number;
  size?: number;
  style?: React.CSSProperties;
};

/** 0 = eyes open, 1 = eyes shut. A quick blink about every 3 seconds. */
const blinkAt = (frame: number) => {
  const p = (frame + 40) % 96;
  return p < 6 ? 1 - Math.abs(p - 3) / 3 : 0;
};

export const FlatMascot: React.FC<Props> = ({ mouth, size = 340, style }) => {
  const b = useBrand();
  const frame = useCurrentFrame();
  const blink = blinkAt(frame);
  const bob = Math.sin(frame / 14) * 6;
  const sway = Math.sin(frame / 10) * 6;
  const armWave = Math.sin(frame / 9) * 5;
  const eyeRy = 26 * (1 - 0.88 * blink);
  const open = Math.max(0, Math.min(1, mouth));
  const mouthRy = 4 + 24 * open;
  const dark = b.colors.text;

  return (
    <div data-el="avatar" data-kind="avatar" style={{ width: size, height: size, ...style }}>
      <svg viewBox="0 0 400 400" width={size} height={size} style={{ overflow: "visible" }}>
        <ellipse cx="200" cy="372" rx="110" ry="14" fill={dark} opacity="0.12" />
        <g transform={`translate(0 ${bob})`}>
          {/* antenna */}
          <line x1="200" y1="76" x2={200 + sway} y2="30" stroke={dark} strokeWidth="9" strokeLinecap="round" />
          <circle cx={200 + sway} cy="26" r="17" fill={b.colors.accent2} />
          {/* feet */}
          <rect x="105" y="318" width="64" height="34" rx="16" fill={dark} opacity="0.85" />
          <rect x="231" y="318" width="64" height="34" rx="16" fill={dark} opacity="0.85" />
          {/* arms */}
          <circle cx="42" cy={238 + armWave} r="28" fill={b.colors.accent} />
          <circle cx="358" cy={238 - armWave} r="28" fill={b.colors.accent} />
          <circle cx="42" cy={238 + armWave} r="28" fill="#000" opacity="0.14" />
          <circle cx="358" cy={238 - armWave} r="28" fill="#000" opacity="0.14" />
          {/* body */}
          <rect x="60" y="72" width="280" height="260" rx="96" fill={b.colors.accent} />
          {/* face plate */}
          <rect x="94" y="108" width="212" height="176" rx="64" fill={b.colors.surface} />
          {/* eyes */}
          <ellipse cx="156" cy="174" rx="20" ry={eyeRy} fill={dark} />
          <ellipse cx="244" cy="174" rx="20" ry={eyeRy} fill={dark} />
          {blink < 0.3 ? (
            <>
              <circle cx="150" cy="164" r="6" fill="#fff" />
              <circle cx="238" cy="164" r="6" fill="#fff" />
            </>
          ) : null}
          {/* cheeks */}
          <circle cx="122" cy="226" r="16" fill={b.colors.accent2} opacity="0.35" />
          <circle cx="278" cy="226" r="16" fill={b.colors.accent2} opacity="0.35" />
          {/* mouth */}
          {open < 0.08 ? (
            <path d="M176 230 Q200 248 224 230" fill="none" stroke={dark} strokeWidth="8" strokeLinecap="round" />
          ) : (
            <>
              <ellipse cx="200" cy={232 + mouthRy * 0.35} rx={26 - 4 * open} ry={mouthRy} fill={dark} />
              {open > 0.45 ? <ellipse cx="200" cy={232 + mouthRy * 0.9} rx="14" ry={mouthRy * 0.38} fill={b.colors.accent2} opacity="0.9" /> : null}
            </>
          )}
        </g>
      </svg>
    </div>
  );
};
