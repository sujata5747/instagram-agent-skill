// Redraws the two PLACEHOLDER sprite sheets (public/avatars/sample-*/sheet.png).
import { spawnSync } from "node:child_process";
import { root } from "./env.mjs";
import { browserFlag, fallbackBrowser } from "./browser.mjs";

for (const [comp, out] of [["PlaceholderSheet-Illustrated", "public/avatars/sample-illustrated/sheet.png"], ["PlaceholderSheet-Pixel", "public/avatars/sample-pixel/sheet.png"]]) {
  const go = (b) => spawnSync("npx", ["remotion", "still", comp, out, ...(b ? [`--browser-executable=${b}`] : [])], { cwd: root, stdio: "inherit" });
  let r = go(browserFlag());
  if (r.status !== 0 && fallbackBrowser()) r = go(fallbackBrowser());
  if (r.status !== 0) process.exit(1);
}
