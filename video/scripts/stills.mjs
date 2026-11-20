// npm run stills: renders a PNG of each scene's busiest moments (config.ts
// `stills`) from the Main composition to out/stills, for a check before the
// full render. Bundles once, then renders every still from that bundle.
// Node 22.6+ runs config.ts directly (type stripping); config.ts has no imports.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { music, scenes, stills, video } from "../src/config.ts";

const sec = (s) => Math.round(s * video.fps);
// Same as lib/time.ts: scene starts snap to the nearest music beat.
const fpb = (60 / music.bpm) * video.fps;
const offset = music.firstBeat * video.fps;
const snap = (f) => Math.round(offset + Math.round((f - offset) / fpb) * fpb);
const start = (name) => (scenes[name].start === 0 ? 0 : snap(sec(scenes[name].start)));

const comp = process.argv[2] ?? "Main";
const run = (args) => execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["remotion", ...args], { stdio: "inherit", shell: process.platform === "win32" });

rmSync("out/stills", { recursive: true, force: true });
mkdirSync("out/stills", { recursive: true });
run(["bundle", "src/index.ts", "--out-dir=out/bundle", "--log=error"]);

for (const [name, times] of Object.entries(stills)) {
  for (const t of times) {
    const frame = start(name) + sec(t);
    const file = `out/stills/${comp}-${name}-${t.toFixed(1)}s-f${frame}.png`;
    run(["still", "out/bundle", comp, file, `--frame=${frame}`, "--log=error"]);
  }
}
console.log("Stills written to out/stills");
