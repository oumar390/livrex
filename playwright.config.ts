import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/api/auth",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      DATABASE_URL: process.env.LIVREX_TEST_DATABASE_URL || "",
      ADMIN_SETUP_TOKEN: process.env.LIVREX_TEST_ADMIN_TOKEN || "",
      LIVREX_DATA_DIR: "/tmp/livrex-tests-" + Date.now(),
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
