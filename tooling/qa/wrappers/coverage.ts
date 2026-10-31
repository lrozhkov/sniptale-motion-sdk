import { readCoverageReport } from "../coverage/report.ts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runQaWrapper } from "../runtime/wrapper-runner.ts";

const repoRoot = process.cwd();
const summaryPath = join(
  repoRoot,
  ".tmp",
  "qa",
  "coverage",
  "coverage-summary.json",
);
const lcovPath = join(repoRoot, ".tmp", "qa", "coverage", "lcov.info");

await runQaWrapper("qa:coverage", async ({ run, writeStdout }) => {
  await run("vitest coverage", "npm", ["run", "test:coverage"]);

  if (!existsSync(summaryPath)) {
    throw new Error("Missing .tmp/qa/coverage/coverage-summary.json report.");
  }
  if (!existsSync(lcovPath)) {
    throw new Error("Missing .tmp/qa/coverage/lcov.info report.");
  }

  const summary: unknown = JSON.parse(readFileSync(summaryPath, "utf8"));
  const report = readCoverageReport(summary);

  writeStdout(`[qa:coverage] report ready: ${report}\n`);
  writeStdout("[qa:coverage] artifacts: .tmp/qa/coverage/lcov.info\n");
});
