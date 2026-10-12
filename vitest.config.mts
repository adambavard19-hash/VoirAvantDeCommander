import { defineConfig } from "vitest/config";
import path from "node:path";
import os from "node:os";

const testDb = process.env.TEST_DATABASE_URL ?? "postgresql://vadc:vadc_dev_password@localhost:5432/vadc_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // Le marqueur « server-only » lève une erreur hors de React Server Components.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/empty.ts"),
    },
  },
  test: {
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 120000,
    fileParallelism: false,
    projects: [
      { extends: true, test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          env: {
            DATABASE_URL: testDb,
            APP_URL: "https://test.voiravantdecommander.fr",
            APP_SECRET: "test-secret-test-secret-test-secret-0123456789",
            STORAGE_DRIVER: "local",
            STORAGE_LOCAL_DIR: path.join(os.tmpdir(), "vadc-test-storage"),
            ANTHROPIC_API_KEY: "",
          },
        },
      },
    ],
  },
});
