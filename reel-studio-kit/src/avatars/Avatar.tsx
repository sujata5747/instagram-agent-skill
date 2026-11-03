import React from "react";
import type { AvatarStyle } from "../components/ReelFrame";
import { FlatMascot } from "./FlatMascot";
import { SHEETS } from "./sheets";
import { SpritePlayer, type PoseCue } from "./SpritePlayer";

type Props = {
  style: AvatarStyle;
  mouth: number;
  /** Pose cues for the sprite styles (ignored by "flat"). */
  cues?: PoseCue[];
  size?: number;
  css?: React.CSSProperties;
};

/** One switch for the three avatar styles. "none" shows nothing. */
export const Avatar: React.FC<Props> = ({ style, mouth, cues = [{ at: 0, pose: 0 }], size = 340, css }) => {
  if (style === "flat") return <FlatMascot mouth={mouth} size={size} style={css} />;
  if (style === "illustrated") return <SpritePlayer sheet={SHEETS.illustrated} cues={cues} mouth={mouth} size={size} style={css} />;
  if (style === "pixel") return <SpritePlayer sheet={SHEETS.pixel} cues={cues} mouth={mouth} size={size} style={css} />;
  return null;
};
