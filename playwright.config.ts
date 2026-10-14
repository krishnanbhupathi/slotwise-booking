import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

// A separate database, migrated and seeded with the demo account before the run.
export const E2E_ENV = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://localhost:5432/slotwise_e2e",
  AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-only-not-a-secret-e2e-only-not-a-secret",
  AUTH_URL: BASE_URL,
  DEMO_EMAIL: "demo@slotwise.dev",
  // Emails are printed, not sent; Stripe is not configured (paid flows are covered by unit tests).
  RESEND_API_KEY: "",
  STRIPE_SECRET_KEY: "",
  ALLOW_CONSOLE_EMAIL: "true",
};

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure", timezoneId: "Asia/Kolkata" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // The production build, so tests see what users get.
    command: `npm run build && npx next start -p ${PORT}`,
    url: BASE_URL,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: E2E_ENV,
  },
});
