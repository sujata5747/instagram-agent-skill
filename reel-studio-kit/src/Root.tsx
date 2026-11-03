import React from "react";
import { Composition, Folder } from "remotion";
import { FPS, HEIGHT, WIDTH } from "./layout";
import { PlaceholderSheet } from "./dev/PlaceholderSheet";
import { REELS } from "./reels/registry";

export const Root: React.FC = () => (
  <>
    {REELS.map((r) => (
      <React.Fragment key={r.id}>
        <Composition id={r.id} component={r.Component} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={r.durationInFrames} defaultProps={{}} />
        {r.variants?.length ? (
          <Folder name={`${r.id}-variants`}>
            {r.variants.map((v) => (
              <Composition
                key={v.suffix}
                id={`${r.id}-${v.suffix}`}
                component={r.Component}
                width={WIDTH}
                height={HEIGHT}
                fps={FPS}
                durationInFrames={r.durationInFrames}
                defaultProps={v.props}
              />
            ))}
          </Folder>
        ) : null}
      </React.Fragment>
    ))}
    <Folder name="Dev">
      <Composition id="PlaceholderSheet-Illustrated" component={PlaceholderSheet} width={2000} height={1600} fps={1} durationInFrames={1} defaultProps={{ look: "illustrated" as const }} />
      <Composition id="PlaceholderSheet-Pixel" component={PlaceholderSheet} width={2000} height={1600} fps={1} durationInFrames={1} defaultProps={{ look: "pixel" as const }} />
    </Folder>
  </>
);
