import type { PlaywrightTestConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const config: PlaywrightTestConfig = {
  use: {
    baseURL,
    headless: true
  },
  testDir: "./tests",
  reporter: [["list"], ["html", { open: "never" }]]
};

export default config;
