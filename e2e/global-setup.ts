import { execSync } from "node:child_process";
import { E2E_ENV } from "../playwright.config";

/** Migrates the e2e database and resets the demo account, so every run starts from the same state. */
export default function globalSetup() {
  const env = { ...process.env, ...E2E_ENV };
  execSync("npx tsx scripts/migrate.ts", { env, stdio: "inherit" });
  execSync("npx tsx scripts/seed.ts", { env, stdio: "inherit" });
}
