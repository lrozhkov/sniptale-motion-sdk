import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: resolve(import.meta.dirname, "../../.."),
  test: {
    coverage: {
      exclude: ["src/**/*.d.{ts,mts,cts}"],
      include: ["src/**/*.{ts,tsx,mts,cts}"],
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: ".tmp/qa/coverage",
    },
  },
});
