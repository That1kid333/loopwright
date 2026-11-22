// Render the example recipes to WAV files and print a short check of each one.
// Usage: node tools/sound-maker/render_examples.mjs <path-to-node-web-audio-api> <out-dir>
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const [waPath, outDir = "out"] = process.argv.slice(2);
const { OfflineAudioContext } = require(waPath || "node-web-audio-api");
const SM = require(path.join(here, "../../site/assets/sound-maker.js"));
const examples = JSON.parse(fs.readFileSync(path.join(here, "examples.json"), "utf8"));
fs.mkdirSync(outDir, { recursive: true });

function stats(buf) {
  const d = buf.getChannelData(0), sr = buf.sampleRate;
  let peak = 0, sum = 0, crossings = 0, firstLoud = -1, lastLoud = 0, nan = 0;
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]); if (!Number.isFinite(d[i])) nan++;
    peak = Math.max(peak, a); sum += d[i] * d[i];
    if (i && (d[i - 1] < 0) !== (d[i] < 0)) crossings++;
  }
  for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > peak * 0.5) { firstLoud = i; break; }
  for (let i = d.length - 1; i >= 0; i--) if (Math.abs(d[i]) > peak * 0.01) { lastLoud = i; break; }
  return {
    seconds: +(d.length / sr).toFixed(2), peak_db: +(20 * Math.log10(peak || 1e-9)).toFixed(1),
    rms_db: +(10 * Math.log10(sum / d.length || 1e-12)).toFixed(1), attack_ms: +((firstLoud / sr) * 1000).toFixed(1),
    audible_s: +(lastLoud / sr).toFixed(2), zero_cross_hz: Math.round(crossings / 2 / (d.length / sr)), bad_samples: nan,
  };
}

let failed = 0;
for (const [i, ex] of examples.entries()) {
  const t = Date.now();
  try {
    const { buffer, recipe, warnings } = await SM.render(ex.recipe, { OfflineAudioContext });
    const file = path.join(outDir, `${String(i + 1).padStart(2, "0")}-${recipe.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.wav`);
    fs.writeFileSync(file, Buffer.from(SM.wav(buffer, 24)));
    const s = stats(buffer);
    const ok = s.bad_samples === 0 && s.peak_db > -3 && s.rms_db > -45;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} "${ex.prompt}" -> ${path.basename(file)} ${JSON.stringify(s)} ${warnings.length ? "warnings: " + warnings.join("; ") : ""} (${Date.now() - t} ms)`);
  } catch (e) { failed++; console.log(`FAIL "${ex.prompt}": ${e.stack}`); }
}
// Bad input must never throw: junk recipes get cleaned up into something playable.
for (const junk of [null, {}, { layers: "x" }, { layers: [{ source: { type: "laser" }, amp: { a: -5, d: 1e9 } }], fx: [{ type: "nuke" }], length: 999 }]) {
  try { const r = await SM.render(junk, { OfflineAudioContext }); console.log(`ok   junk recipe -> ${r.recipe.length}s, warnings: ${r.warnings.join("; ") || "none"}`); }
  catch (e) { failed++; console.log(`FAIL junk recipe threw: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
