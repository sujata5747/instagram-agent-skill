// Shared: pick a browser for Remotion. Set BROWSER_EXECUTABLE to force one.
// If Remotion's own headless Chrome cannot start, macOS users can fall back to installed Google Chrome.
import fs from "node:fs";

export const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export const browserFlag = () => {
  const forced = process.env.BROWSER_EXECUTABLE;
  if (forced) return forced;
  return null;
};

export const fallbackBrowser = () => (fs.existsSync(MAC_CHROME) ? MAC_CHROME : null);
