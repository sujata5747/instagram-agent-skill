// Draws the PLACEHOLDER sprite sheets (a 5-column x 4-row grid of simple coloured figures) so the sprite
// player works out of the box. Not a real character: replace with a sheet made from
// sprites/PROMPT.md. Render with `npm run sprites:placeholders`.
import React from "react";
import { AbsoluteFill } from "remotion";

const CELL = 400;
const GREEN = "#00FF00";
const OUTLINE = 14; // white sticker outline, px

type Shape =
  | { t: "circle"; cx: number; cy: number; r: number; c: string }
  | { t: "seg"; x1: number; y1: number; x2: number; y2: number; w: number; c: string }
  | { t: "rect"; x: number; y: number; w: number; h: number; rx: number; c: string };

// [left arm angle, right arm angle, brow tilt]. Angle: 0 = hanging down, 90 = straight out, 180 = up.
const POSES: [number, number, number][] = [
  [10, 10, 0], [20, 70, 0], [10, 170, 0], [10, 95, 0], [95, 10, 0],
  [20, 30, 0], [10, 160, 0], [10, 155, 0], [10, 150, 0], [150, 150, 1],
  [10, 130, 0], [10, 120, 0], [45, 15, -1], [75, 75, 2], [10, 145, 0],
  [10, 105, 0], [70, 70, 0], [10, 100, 0], [60, 60, 1], [55, 55, 2],
];

const personShapes = (poseIndex: number, chunky: boolean, palette: { shirt: string; pants: string; hair: string }): Shape[] => {
  const [la, ra, brow] = POSES[poseIndex];
  const skin = "#F2C9A0";
  const L = 90;
  const rad = (d: number) => (d * Math.PI) / 180;
  const arm = (sx: number, dir: 1 | -1, ang: number): Shape[] => {
    const ex = sx + dir * L * Math.sin(rad(ang));
    const ey = 215 + L * Math.cos(rad(ang));
    return [
      { t: "seg", x1: sx, y1: 215, x2: ex, y2: ey, w: 34, c: palette.shirt },
      { t: "circle", cx: ex, cy: ey, r: 19, c: skin },
    ];
  };
  const f = chunky ? 1.4 : 1;
  return [
    { t: "rect", x: 160, y: 300, w: 34, h: 64, rx: 8, c: palette.pants },
    { t: "rect", x: 206, y: 300, w: 34, h: 64, rx: 8, c: palette.pants },
    { t: "rect", x: 140, y: 196, w: 120, h: 128, rx: 34, c: palette.shirt },
    ...arm(150, -1, la),
    ...arm(250, 1, ra),
    { t: "circle", cx: 200, cy: 112, r: 76, c: palette.hair },
    { t: "circle", cx: 200, cy: 130, r: 70, c: skin },
    { t: "circle", cx: 176, cy: 116, r: 7 * f, c: "#2A2A33" },
    { t: "circle", cx: 224, cy: 116, r: 7 * f, c: "#2A2A33" },
    { t: "seg", x1: 160, y1: 98 - brow * 3, x2: 190, y2: 98 + brow * 3, w: 6 * f, c: palette.hair },
    { t: "seg", x1: 210, y1: 98 + brow * 3, x2: 240, y2: 98 - brow * 3, w: 6 * f, c: palette.hair },
    // closed mouth (the player draws the open mouth on top)
    { t: "seg", x1: 188, y1: 142, x2: 212, y2: 142, w: 6 * f, c: "#7A3B3B" },
  ];
};

const segDist = (px: number, py: number, s: Extract<Shape, { t: "seg" }>) => {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const u = Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (s.x1 + u * dx), py - (s.y1 + u * dy)) - s.w / 2;
};
const signed = (s: Shape, px: number, py: number): number => {
  if (s.t === "circle") return Math.hypot(px - s.cx, py - s.cy) - s.r;
  if (s.t === "seg") return segDist(px, py, s);
  const qx = Math.abs(px - (s.x + s.w / 2)) - (s.w / 2 - s.rx);
  const qy = Math.abs(py - (s.y + s.h / 2)) - (s.h / 2 - s.rx);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - s.rx;
};

const SvgShape: React.FC<{ s: Shape; outline?: boolean }> = ({ s, outline }) => {
  const fill = outline ? "#fff" : s.c;
  const stroke = outline ? { stroke: "#fff", strokeWidth: OUTLINE * 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const } : {};
  if (s.t === "circle") return <circle cx={s.cx} cy={s.cy} r={s.r} fill={fill} {...stroke} />;
  if (s.t === "rect") return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={fill} {...stroke} />;
  return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={outline ? "#fff" : s.c} strokeWidth={outline ? s.w + OUTLINE * 2 : s.w} strokeLinecap="round" />;
};

const IllustratedCell: React.FC<{ i: number }> = ({ i }) => {
  const shapes = personShapes(i, false, { shirt: "#5B8DEF", pants: "#3B4252", hair: "#3A2E39" });
  return (
    <g>
      {shapes.map((s, k) => <SvgShape key={`o${k}`} s={s} outline />)}
      {shapes.map((s, k) => <SvgShape key={`f${k}`} s={s} />)}
    </g>
  );
};

const PIX = 10; // 1 "pixel" = 10 sheet px, so a cell is a 40x40 picture
const PixelCell: React.FC<{ i: number }> = ({ i }) => {
  const shapes = personShapes(i, true, { shirt: "#E8590C", pants: "#364FC7", hair: "#2B2B2B" });
  const rects: React.ReactNode[] = [];
  const n = CELL / PIX;
  for (let y = 0; y < n; y++) {
    let runStart = -1;
    let runColor = "";
    const flush = (endX: number) => {
      if (runStart >= 0) rects.push(<rect key={`${y}-${runStart}`} x={runStart * PIX} y={y * PIX} width={(endX - runStart) * PIX} height={PIX} fill={runColor} />);
      runStart = -1;
    };
    for (let x = 0; x < n; x++) {
      const px = x * PIX + PIX / 2;
      const py = y * PIX + PIX / 2;
      let color = "";
      for (let k = shapes.length - 1; k >= 0; k--) {
        if (signed(shapes[k], px, py) <= 0) { color = shapes[k].c; break; }
      }
      if (!color && shapes.some((s) => signed(s, px, py) <= OUTLINE)) color = "#FFFFFF";
      if (color !== runColor || !color) {
        flush(x);
        if (color) { runStart = x; runColor = color; } else runColor = "";
      }
    }
    flush(n);
  }
  return <g shapeRendering="crispEdges">{rects}</g>;
};

export const PlaceholderSheet: React.FC<{ look: "illustrated" | "pixel" }> = ({ look }) => (
  <AbsoluteFill style={{ background: GREEN }}>
    <svg width={CELL * 5} height={CELL * 4} viewBox={`0 0 ${CELL * 5} ${CELL * 4}`}>
      {Array.from({ length: 20 }, (_, i) => (
        <g key={i} transform={`translate(${(i % 5) * CELL} ${Math.floor(i / 5) * CELL})`}>
          {look === "pixel" ? <PixelCell i={i} /> : <IllustratedCell i={i} />}
        </g>
      ))}
    </svg>
  </AbsoluteFill>
);
