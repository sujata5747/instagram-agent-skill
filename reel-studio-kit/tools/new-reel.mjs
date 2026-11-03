// Usage: npm run new -- <reel-id>      (lowercase letters, numbers and dashes)
// Creates src/reels/<id>/Reel.tsx from templates/reel, the content folders, and registers it.
import fs from "node:fs";
import path from "node:path";
import { root } from "./env.mjs";

const id = process.argv[2];
if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) { console.error("Usage: npm run new -- <reel-id>   e.g. npm run new -- sleep-tips"); process.exit(1); }
const mk = (p) => fs.mkdirSync(path.join(root, p), { recursive: true });
if (fs.existsSync(path.join(root, "src/reels", id))) { console.error(`src/reels/${id} already exists.`); process.exit(1); }

mk(`src/reels/${id}`); mk(`projects/${id}`); mk(`public/reels/${id}`);
const tpl = fs.readFileSync(path.join(root, "templates/reel/Reel.tsx"), "utf8").replaceAll("__ID__", id);
fs.writeFileSync(path.join(root, `src/reels/${id}/Reel.tsx`), tpl);
fs.writeFileSync(path.join(root, `projects/${id}/script.md`), `# ${id}\n\n## Hook (max 3 s)\n\n## Beats\n\n## Twist\n\n## CTA (comment keyword)\n\n## Facts and sources\n`);
fs.writeFileSync(path.join(root, `projects/${id}/voice.txt`), "");
fs.writeFileSync(path.join(root, `projects/${id}/captions.txt`), "");
fs.writeFileSync(path.join(root, `public/reels/${id}/captions.words.json`), "[]\n");
fs.writeFileSync(path.join(root, `public/reels/${id}/mouth.json`), "[]\n");

const name = "r_" + id.replace(/-/g, "_");
const regPath = path.join(root, "src/reels/registry.ts");
let reg = fs.readFileSync(regPath, "utf8");
reg = reg.replace("// <new-reel-imports>", `import * as ${name} from "./${id}/Reel";\n// <new-reel-imports>`);
reg = reg.replace("// <new-reel-entries>", `{ id: "${id}", Component: ${name}.Reel, durationInFrames: ${name}.durationInFrames },\n  // <new-reel-entries>`);
fs.writeFileSync(regPath, reg);
console.log(`Created reel "${id}". Edit src/reels/${id}/Reel.tsx, projects/${id}/*, then follow the steps in .claude/skills/reels/SKILL.md.`);
