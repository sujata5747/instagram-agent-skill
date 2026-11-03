import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Word } from "../timing";

/**
 * Mouth openness (0 closed .. 1 wide open) for the current frame.
 * - With a loudness file (public/reels/<id>/mouth.json, one number per frame, made by
 *   `npm run lipsync -- <id>`) the mouth follows the real voice.
 * - Without it, the mouth just flaps while a caption word is being spoken.
 */
export const useMouth = (mouth: number[] | undefined, words: Word[]): number => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (mouth && mouth.length) return mouth[Math.min(frame, mouth.length - 1)] ?? 0;
  const t = frame / fps;
  const w = words.find((x) => t >= x.start && t <= x.end);
  return w ? 0.35 + 0.45 * Math.abs(Math.sin((t - w.start) * 18)) : 0;
};
