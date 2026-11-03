// Tiny .env loader (no dependency). Keys live in .env (never committed) or in your shell environment.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, ".env");
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]] && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
export const requireKey = (name, hint) => {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} is not set. Copy .env.example to .env and add it (${hint}), or export it in your shell.`);
    process.exit(1);
  }
  return v;
};
export { root };
