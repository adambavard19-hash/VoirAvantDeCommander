import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

/**
 * Tests de bout en bout. Prérequis : base migrée et données de démonstration
 * (npm run db:seed). Le serveur de développement est lancé automatiquement
 * s'il ne tourne pas déjà.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: { executablePath, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, locale: "fr-FR" } },
    { name: "iphone", use: { ...devices["iPhone 14 Pro"], browserName: "chromium", locale: "fr-FR" }, testMatch: /menu\.spec/ },
    { name: "android", use: { ...devices["Pixel 7"], locale: "fr-FR" }, testMatch: /menu\.spec/ },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
