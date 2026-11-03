// Two small helpers that make the self-check possible.
//
// SceneBlock  - shows its children only between two frames (absolute frames, so the
//               `at` numbers you pass to pop-in components stay absolute too).
// LayoutProbe - used by `npm run check`. After a frame is drawn it measures every element
//               marked data-el and logs a one-line JSON report (overflow, outside the safe
//               zone, overlaps, empty scene). It draws nothing and is off in normal renders.
import React, { useEffect, useState } from "react";
import { continueRender, delayRender, useCurrentFrame } from "remotion";
import { HEIGHT, SAFE, WIDTH } from "../layout";

export const SceneBlock: React.FC<{ name: string; from: number; to: number; children: React.ReactNode }> = ({ name, from, to, children }) => {
  const frame = useCurrentFrame();
  if (frame < from || frame >= to) return null;
  return (
    <div data-scene={name} style={{ position: "absolute", inset: 0 }}>
      {children}
    </div>
  );
};

type Issue = { type: string; el: string; detail: string };

const effectiveOpacity = (el: Element): number => {
  let o = 1;
  for (let e: Element | null = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity || "1");
  return o;
};

const measure = (frame: number) => {
  const issues: Issue[] = [];
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-el]")).filter((e) => effectiveOpacity(e) > 0.5);
  const tol = 3;
  // Measure the settled layout: switch off the pop-in transform (it overshoots) while measuring.
  const saved = els.map((e) => e.style.transform);
  els.forEach((e) => (e.style.transform = "none"));
  const boxes = els.map((e) => ({ e, name: e.dataset.el || "el", r: e.getBoundingClientRect() }));
  els.forEach((e, i) => (e.style.transform = saved[i]));

  for (const { e, name, r } of boxes) {
    if (r.left < SAFE.left - tol || r.right > WIDTH - SAFE.right + tol || r.top < SAFE.top - tol || r.bottom > HEIGHT - SAFE.bottom + tol) {
      issues.push({
        type: "safe-zone",
        el: name,
        detail: `box ${Math.round(r.left)},${Math.round(r.top)} to ${Math.round(r.right)},${Math.round(r.bottom)} leaves the safe box`,
      });
    }
    for (const n of [e, ...Array.from(e.querySelectorAll<HTMLElement>("*"))]) {
      if (n.clientWidth > 0 && n.scrollWidth > n.clientWidth + 2) {
        issues.push({ type: "overflow", el: name, detail: `text is ${n.scrollWidth}px wide in a ${n.clientWidth}px box` });
        break;
      }
      if (n.clientHeight > 0 && n.scrollHeight > n.clientHeight + 2 && getComputedStyle(n).overflow !== "visible") {
        issues.push({ type: "overflow", el: name, detail: `content is ${n.scrollHeight}px tall in a ${n.clientHeight}px box` });
        break;
      }
    }
  }

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      // A sticker may sit on a card corner (data-overlap-ok="card") but not on text or other things.
      const okOn = (x: typeof a, y: typeof a) => x.e.dataset.overlapOk === "card" && (y.name === "card" || y.name === "endcard");
      if (okOn(a, b) || okOn(b, a)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w <= 0 || h <= 0) continue;
      const small = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
      if ((w * h) / small > 0.06) issues.push({ type: "overlap", el: `${a.name}+${b.name}`, detail: `overlap ${Math.round(w)}x${Math.round(h)}px` });
    }
  }

  // A box that is on screen but whose text has not appeared yet looks like an empty white card.
  for (const { e, name } of boxes) {
    if (name !== "card" && name !== "endcard") continue;
    const texts = Array.from(e.querySelectorAll<HTMLElement>("*")).filter((n) => Array.from(n.childNodes).some((c) => c.nodeType === 3 && (c.textContent || "").trim()));
    if (texts.length && !texts.some((n) => effectiveOpacity(n) > 0.3)) issues.push({ type: "empty-box", el: name, detail: "box is visible but none of its text has appeared yet" });
  }

  const content = boxes.filter((b) => b.e.dataset.kind === "content").length;
  const scene = document.querySelector<HTMLElement>("[data-scene]")?.dataset.scene ?? "";
  return { frame, scene, content, els: boxes.map((b) => b.name), issues };
};

export const LayoutProbe: React.FC = () => {
  const frame = useCurrentFrame();
  const [handle] = useState(() => delayRender("layout probe"));
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      console.log("REEL_PROBE " + JSON.stringify(measure(frame)));
      continueRender(handle);
    });
    return () => cancelAnimationFrame(id);
  }, [frame, handle]);
  return null;
};
