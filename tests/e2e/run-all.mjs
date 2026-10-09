// Runs every e2e suite against a production server on :3123 and the real database.
//   npm run build && npm run start -- -p 3123     (in another terminal)
//   npm run test:e2e                              (or: npm run test:e2e -- feed social)
// oauth-http is skipped by default: it needs a build made WITH fake provider keys (see tests/e2e/README.md).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const dir = new URL(".", import.meta.url);
const all = readdirSync(dir).filter((f) => f.endsWith(".mjs") && f !== "run-all.mjs").map((f) => f.slice(0, -4));
const picked = process.argv.slice(2);
const suites = picked.length ? picked : all.filter((s) => s !== "oauth-http");

try {
  await fetch("http://localhost:3123/", { signal: AbortSignal.timeout(5000) });
} catch {
  console.error("No server on http://localhost:3123. Run `npm run build && npm run start -- -p 3123` first.");
  process.exit(1);
}

const results = [];
for (const s of suites) {
  const run = spawnSync(process.execPath, [new URL(`${s}.mjs`, dir).pathname.replace(/^\/([A-Za-z]:)/, "$1")], { encoding: "utf8" });
  const out = `${run.stdout}${run.stderr}`;
  // A crash or a missing summary line counts as a failure, never a silent pass.
  const ok = run.status === 0 && out.includes("ALL CHECKS PASSED");
  results.push([s, ok]);
  console.log(`${ok ? "ok    " : "FAILED"}  ${s}`);
  if (!ok) console.log(out.split("\n").filter((l) => /^FAIL|Error/.test(l)).map((l) => `        ${l}`).join("\n") || out.slice(-1500));
}

const failed = results.filter(([, ok]) => !ok).map(([s]) => s);
console.log(failed.length ? `\n${failed.length}/${results.length} suite(s) failed: ${failed.join(", ")}` : `\nall ${results.length} suites passed`);
process.exit(failed.length ? 1 : 0);
