// DEMO reel (about 15 s): "3 rules for a reel people finish".
// Read this file as the pattern for your own reels (`npm run new -- my-reel` copies templates/reel).
//   * words      -> when each word is spoken (public/reels/demo/captions.words.json)
//   * t.at / t.atText -> frame numbers to start scenes and pop things on a word
//   * SceneBlock -> one scene = a start frame and an end frame
//   * Karaoke    -> synced captions, Avatar -> talking character, both stay on screen across scenes
import React from "react";
import { brand as myBrand } from "../../brand";
import { Avatar } from "../../avatars/Avatar";
import { useMouth } from "../../avatars/useMouth";
import type { PoseCue } from "../../avatars/SpritePlayer";
import { BigNumber, Card, EndCard, Karaoke, Line, ReelFrame, SceneBlock, Sticker, Title, type ReelProps } from "../../components";
import { AVATAR_BOX, CAPTION_BOTTOM, SAFE, SAFE_BOX } from "../../layout";
import { timing } from "../../timing";
import mouth from "../../../public/reels/demo/mouth.json";
import words from "../../../public/reels/demo/captions.words.json";

export const t = timing(words);
export const AUDIO = "reels/demo/vo.wav";

// Scene boundaries, all taken from spoken words so the cuts land on the voice.
const S = {
  hook: [0, t.atText("Rule", 4.2, 0)],
  rules: [t.atText("Rule", 4.2, 0), t.atText("Rule", 8.7, 2)],
  three: [t.atText("Rule", 8.7, 2), t.atText("Comment", 12.6)],
  end: [t.atText("Comment", 12.6), t.duration()],
} as const;

// Poses for the illustrated / pixel avatars: a plain list of "from this second, show this pose".
const poseCues: PoseCue[] = [
  { at: 0, pose: "idle" },
  { at: 2.3, pose: "explain" },
  { at: 4.2, pose: "one" },
  { at: 5.8, pose: "two" },
  { at: 8.7, pose: "three" },
  { at: 11.5, pose: "point-right" },
  { at: 12.6, pose: "point-down" },
];

export const durationInFrames = t.duration();

export const Reel: React.FC<ReelProps> = ({ brand = myBrand, avatar = "flat", debugSafeZones, probe }) => {
  const m = useMouth(mouth, words);
  return (
    <ReelFrame brand={brand} audio={AUDIO} debugSafeZones={debugSafeZones} probe={probe}>
      {/* Scene 1: hook */}
      <SceneBlock name="hook" from={S.hook[0]} to={S.hook[1]}>
        <div style={{ position: "absolute", left: SAFE_BOX.x, top: SAFE.top + 40, width: SAFE_BOX.width }}>
          <Title text="Your reel dies in 3 seconds" highlight="3 seconds" at={t.at(0)} size={118} />
        </div>
        <Sticker text="fix it" at={t.atText("Here", 2.3)} rotate={7} style={{ position: "absolute", left: 640, top: 640 }} />
      </SceneBlock>

      {/* Scene 2: rule one and two */}
      <SceneBlock name="rules" from={S.rules[0]} to={S.rules[1]}>
        <div style={{ position: "absolute", left: SAFE_BOX.x, top: 300, width: SAFE_BOX.width }}>
          <Card at={S.rules[0]}>
            <BigNumber to={2} at={S.rules[0] + 3} label="rules so far" size={170} tracked={false} />
            <div style={{ height: 32 }} />
            <Line first at={t.atText("one", 4.4)}>1 &nbsp;Hook first</Line>
            <Line at={t.atText("two", 6.1)}>2 &nbsp;New scene every 5 s</Line>
          </Card>
        </div>
      </SceneBlock>

      {/* Scene 3: rule three */}
      <SceneBlock name="three" from={S.three[0]} to={S.three[1]}>
        <div style={{ position: "absolute", left: SAFE_BOX.x, top: 330, width: SAFE_BOX.width }}>
          <Card at={S.three[0]}>
            <BigNumber to={2} suffix=" s" at={S.three[0] + 4} label={<>something<br />moves</>} tracked={false} size={240} />
          </Card>
        </div>
        <Sticker text="keep it moving" at={t.atText("something", 9.8)} rotate={-6} style={{ position: "absolute", left: 520, top: 700 }} />
      </SceneBlock>

      {/* Scene 4: end card */}
      <SceneBlock name="end" from={S.end[0]} to={S.end[1]}>
        <div style={{ position: "absolute", left: SAFE_BOX.x, top: 300, width: SAFE_BOX.width }}>
          <EndCard keyword="KIT" lead="Want the kit?" sub="I will send it to you" at={t.atText("KIT", 13)} />
        </div>
      </SceneBlock>

      {/* Always on: talking character + captions */}
      {avatar !== "none" ? (
        <div style={{ position: "absolute", left: AVATAR_BOX.x, top: AVATAR_BOX.y }}>
          <Avatar style={avatar} mouth={m} cues={poseCues} size={AVATAR_BOX.size} />
        </div>
      ) : null}
      <div style={{ position: "absolute", left: SAFE_BOX.x, width: SAFE_BOX.width, bottom: CAPTION_BOTTOM }}>
        <Karaoke words={words} perChunk={4} keywords={["KIT", "three", "seconds"]} />
      </div>
    </ReelFrame>
  );
};
