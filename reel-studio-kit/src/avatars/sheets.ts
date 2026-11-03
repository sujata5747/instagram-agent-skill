// Sprite-sheet settings for the "illustrated" and "pixel" avatar styles.
// To use your own character: drop your sheet at public/avatars/<name>/sheet.png and
// copy one of these entries. Fractions (0-1) are measured inside ONE cell.
export type SheetConfig = {
  /** Path inside public/. */
  src: string;
  cols: number;
  rows: number;
  /** Optional names for poses, so cues can say "point" instead of 7. Index = cell number (left to right, top to bottom). */
  poseNames?: string[];
  /** Where the mouth is inside a cell (same in every pose, because the head stays put). */
  mouth: { x: number; y: number; w: number; h: number; color?: string };
  /** Optional blink: draws closed eyelids over the eyes now and then. Leave out to skip blinking. */
  blink?: { eyes: { x: number; y: number }[]; w: number; h: number; lidColor: string; lineColor: string };
  /** Use nearest-neighbour scaling (crisp pixels). */
  pixelated?: boolean;
  /** Green background to remove. Default "#00FF00". */
  key?: string;
};

export const POSE_NAMES = [
  "idle", "explain", "finger-up", "point-right", "point-left",
  "point-down", "one", "two", "three", "five",
  "thumbs-up", "ok", "thinking", "shrug", "wave",
  "phone", "arms-crossed", "present", "rubbing-hands", "heart-hands",
];

export const SHEETS = {
  illustrated: {
    src: "avatars/sample-illustrated/sheet.png",
    cols: 5,
    rows: 4,
    poseNames: POSE_NAMES,
    mouth: { x: 0.5, y: 0.355, w: 0.15, h: 0.1 },
    blink: { eyes: [{ x: 0.44, y: 0.29 }, { x: 0.56, y: 0.29 }], w: 0.05, h: 0.05, lidColor: "#F2C9A0", lineColor: "#2A2A33" },
  },
  pixel: {
    src: "avatars/sample-pixel/sheet.png",
    cols: 5,
    rows: 4,
    poseNames: POSE_NAMES,
    mouth: { x: 0.5, y: 0.355, w: 0.15, h: 0.1 },
    blink: { eyes: [{ x: 0.44, y: 0.29 }, { x: 0.56, y: 0.29 }], w: 0.05, h: 0.05, lidColor: "#F2C9A0", lineColor: "#2A2A33" },
    pixelated: true,
  },
} satisfies Record<string, SheetConfig>;
