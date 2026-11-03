// Canvas + Instagram-safe zones for a 9:16 reel.
// The numbers are APPROXIMATE. Instagram's overlay changes with the app version,
// phone size and caption length, so keep a little extra margin.

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;

export const SAFE = {
  top: 220, // "Reels" title, camera icon
  bottom: 380, // username, caption, audio name: the biggest no-go area
  right: 120, // like / comment / share / save buttons
  left: 60, // margin off the screen edge
};

// The rectangle where text, numbers and faces are safe to place.
export const SAFE_BOX = {
  x: SAFE.left,
  y: SAFE.top,
  width: WIDTH - SAFE.left - SAFE.right,
  height: HEIGHT - SAFE.top - SAFE.bottom,
};

/** Where the captions sit (bottom edge of the safe box) and where scene content may live above them. */
export const CAPTION_BOTTOM = SAFE.bottom + 24; // distance from the bottom of the frame
export const AVATAR_BOX = { x: SAFE.left, y: 960, size: 340 };
