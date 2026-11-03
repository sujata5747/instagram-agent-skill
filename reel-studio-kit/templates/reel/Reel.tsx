// Reel "__ID__". Claude fills this in during the SCENES step (see .claude/skills/reels/SKILL.md).
// Pattern: pick scene start frames from SPOKEN WORDS (t.atText / t.at), pop elements on words.
// Demo to copy from: src/reels/demo/Reel.tsx
import React from "react";
import { brand as myBrand } from "../../brand";
import { Avatar } from "../../avatars/Avatar";
import { useMouth } from "../../avatars/useMouth";
import type { PoseCue } from "../../avatars/SpritePlayer";
import { Card, EndCard, Karaoke, Line, ReelFrame, SceneBlock, Title, type ReelProps } from "../../components";
import { AVATAR_BOX, CAPTION_BOTTOM, SAFE, SAFE_BOX } from "../../layout";
import { timing } from "../../timing";
import mouth from "../../../public/reels/__ID__/mouth.json";
import words from "../../../public/reels/__ID__/captions.words.json";

export const t = timing(words);
export const AUDIO = "reels/__ID__/vo.wav";
export const durationInFrames = t.duration();

// Scene cuts on spoken words: [start frame, end frame]. Aim for a new scene every 4-8 s.
const S = {
  hook: [0, t.at(8, 4)],
  body: [t.at(8, 4), t.at(20, 10)],
  end: [t.at(20, 10), t.duration()],
} as const;

// Sprite avatars only: "from this second, show this pose" (ignored by the flat mascot).
const poseCues: PoseCue[] = [{ at: 0, pose: "idle" }];

export const Reel: React.FC<ReelProps> = ({ brand = myBrand, avatar = "flat", debugSafeZones, probe }) => {
  const m = useMouth(mouth, words);
  return (
    <ReelFrame brand={brand} audio={AUDIO} debugSafeZones={debugSafeZones} probe={probe}>
      <SceneBlock name="hook" from={S.hook[0]} to={S.hook[1]}>
        <div style={{ position: "absolute", left: SAFE_BOX.x, top: SAFE.top + 40, width: SAFE_BOX.width }}>
          <Title text="Your hook, max 7 words" highlight="hook" at={t.at(0)} size={118} />
        </div>
      </SceneBlock>

      <SceneBlock name="body" from={S.body[0]} to={S.body[1]}>
        <div style={{ position: "absolute", left: SAFE_BOX.x, top: 300, width: SAFE_BOX.width }}>
          <Card at={S.body[0]}>
            <Line first at={t.at(9, 5)}>First point</Line>
            <Line at={t.at(14, 7)}>Second point</Line>
          </Card>
        </div>
      </SceneBlock>

      <SceneBlock name="end" from={S.end[0]} to={S.end[1]}>
        <div style={{ position: "absolute", left: SAFE_BOX.x, top: 300, width: SAFE_BOX.width }}>
          <EndCard keyword="KEYWORD" lead="Want it?" sub="I will send it to you" at={S.end[0]} />
        </div>
      </SceneBlock>

      {avatar !== "none" ? (
        <div style={{ position: "absolute", left: AVATAR_BOX.x, top: AVATAR_BOX.y }}>
          <Avatar style={avatar} mouth={m} cues={poseCues} size={AVATAR_BOX.size} />
        </div>
      ) : null}
      <div style={{ position: "absolute", left: SAFE_BOX.x, width: SAFE_BOX.width, bottom: CAPTION_BOTTOM }}>
        <Karaoke words={words} perChunk={4} keywords={[]} />
      </div>
    </ReelFrame>
  );
};
