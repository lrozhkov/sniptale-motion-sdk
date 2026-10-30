import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  root: resolve(import.meta.dirname, "../../.."),
  test: {
    // Browser launches and Git/filesystem audits share this worker budget.
    maxWorkers: 4,
    exclude: [...configDefaults.exclude, "**/.tmp/**"],
    coverage: {
      exclude: ["src/**/*.d.{ts,mts,cts}"],
      include: ["src/**/*.{ts,tsx,mts,cts}"],
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: ".tmp/qa/coverage",
    },
  },
});
