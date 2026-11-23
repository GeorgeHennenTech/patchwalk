import { defineConfig } from "@playwright/test";

// Browser tests of the real page: `npm run e2e`. They start the dev server themselves (or use one already
// running), run in headless Chromium with sound allowed, and measure audio rather than listen to it.
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  timeout: 60_000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1500, height: 1250 },
    trace: "off",
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
  },
  webServer: { command: "npm run dev", url: "http://localhost:5173", reuseExistingServer: true, timeout: 60_000 },
});
