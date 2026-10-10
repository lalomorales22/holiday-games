import { defineConfig } from "@playwright/test";
import fs from "node:fs";
export default defineConfig({
  testDir: "./tests",
  testMatch: "browser.spec.js",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: [
        "--no-sandbox",
        "--enable-unsafe-swiftshader",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/browser-server.js",
    url: "http://127.0.0.1:4173/api/health",
    reuseExistingServer: false,
    timeout: 20000,
  },
});
