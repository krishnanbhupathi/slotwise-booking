// Runs Lighthouse against deployed pages and writes the raw JSON reports plus
// a median summary to docs/measurements/lighthouse-<date>/. These reports are
// the source for any performance figure quoted in the README or case study.
//   node scripts/lighthouse.mjs <label>=<url> [<label>=<url> …]
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const RUNS = 3;
const pages = process.argv.slice(2).map((a) => {
  const i = a.indexOf("=");
  return { label: a.slice(0, i), url: a.slice(i + 1) };
});
if (!pages.length) throw new Error("usage: node scripts/lighthouse.mjs label=url …");

const date = new Date().toISOString().slice(0, 10);
const out = path.join(import.meta.dirname, "..", "docs", "measurements", `lighthouse-${date}`);
mkdirSync(out, { recursive: true });

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const rows = [];
for (const { label, url } of pages) {
  for (const form of ["mobile", "desktop"]) {
    const runs = [];
    for (let i = 1; i <= RUNS; i++) {
      const file = path.join(out, `${label}-${form}-${i}.json`);
      execFileSync("npx", ["-y", "lighthouse@12.8.2", url, "--quiet", "--output=json", `--output-path=${file}`, "--chrome-flags=--headless=new",
        ...(form === "desktop" ? ["--preset=desktop"] : [])], { stdio: "inherit" });
      const r = JSON.parse(readFileSync(file, "utf8"));
      runs.push({
        performance: r.categories.performance.score * 100,
        accessibility: r.categories.accessibility.score * 100,
        bestPractices: r.categories["best-practices"].score * 100,
        seo: r.categories.seo.score * 100,
        lcpMs: r.audits["largest-contentful-paint"].numericValue,
        tbtMs: r.audits["total-blocking-time"].numericValue,
        cls: r.audits["cumulative-layout-shift"].numericValue,
      });
    }
    const m = Object.fromEntries(Object.keys(runs[0]).map((k) => [k, median(runs.map((r) => r[k]))]));
    rows.push({ label, url, form, ...m });
  }
}

const fmt = (r) =>
  `| ${r.label} | ${r.form} | ${Math.round(r.performance)} | ${Math.round(r.accessibility)} | ${Math.round(r.bestPractices)} | ${Math.round(r.seo)} | ${(r.lcpMs / 1000).toFixed(1)} s | ${Math.round(r.tbtMs)} ms | ${r.cls.toFixed(3)} |`;
const md = [
  `# Lighthouse ${date}`,
  "",
  `Lighthouse 12.8.2, headless Chrome, median of ${RUNS} runs per row, measured from the author's machine (India) against production. Mobile = Lighthouse's default throttled mobile profile.`,
  "",
  "| Page | Form factor | Perf | A11y | Best practices | SEO | LCP | TBT | CLS |",
  "|---|---|---|---|---|---|---|---|---|",
  ...rows.map(fmt),
  "",
  ...pages.map((p) => `- ${p.label}: ${p.url}`),
  "",
].join("\n");
writeFileSync(path.join(out, "SUMMARY.md"), md);
writeFileSync(path.join(out, "summary.json"), JSON.stringify(rows, null, 2));
console.log(md);
