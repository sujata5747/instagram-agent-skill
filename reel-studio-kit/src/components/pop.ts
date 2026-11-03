import type React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Spring pop-in that starts at frame `at`.
 * Returns a style (scale 0.6 -> 1 with a little overshoot, fade, small lift)
 * plus `progress` (0 -> 1) if you want to animate something else with it.
 */
export const usePop = (at: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - at, fps, config: { damping: 12, stiffness: 170, mass: 0.8 } });
  return {
    progress,
    style: {
      opacity: interpolate(frame - at, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      transform: `translateY(${(1 - progress) * 40}px) scale(${0.6 + 0.4 * progress})`,
    } as React.CSSProperties,
  };
};
