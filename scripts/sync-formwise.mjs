// Copies the Formwise renderer (schema, validation, <FormFields>/<FormRenderer>,
// styles) from the formwise-builder repo into src/vendor/formwise.
// Vendored rather than installed from npm (decision: Day 6). Re-run after
// changing the renderer:  node scripts/sync-formwise.mjs [path-to-formwise-builder]
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, "../../formwise-builder"));
const src = path.join(root, "packages/renderer/src");
const out = path.join(import.meta.dirname, "../src/vendor/formwise");
const commit = execFileSync("git", ["-C", root, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const dirty = execFileSync("git", ["-C", root, "status", "--porcelain", "packages/renderer"], { encoding: "utf8" }).trim();

const FILES = ["schema.ts", "validation.ts", "core.ts", "FormRenderer.tsx", "index.ts", "styles.css"];
const header = (c) => `${c} Vendored from formwise-builder/packages/renderer@${commit}${dirty ? " (+local changes)" : ""}. Do not edit here: change Formwise, then run scripts/sync-formwise.mjs.`;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const file of FILES) {
  // Formwise uses "./x.js" specifiers (needed by its npm consumers); Next's bundler wants them extensionless.
  const text = readFileSync(path.join(src, file), "utf8").replace(/(from\s+["']\.\/[\w-]+)\.js(["'])/g, "$1$2");
  const banner = file.endsWith(".css") ? `/*${header("")} */` : header("//");
  writeFileSync(path.join(out, file), `${banner}\n${text}`);
}
console.log(`Synced ${FILES.length} files from formwise-builder@${commit}${dirty ? " (dirty)" : ""} → src/vendor/formwise`);
