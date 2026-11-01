import { readRegistry } from "../policy/technical-debt/registry.ts";
import { codeqlRoot, readCodeqlToolchain } from "../../ci/codeql-toolchain.ts";
import { readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runQaWrapper } from "../runtime/wrapper-runner.ts";
import {
  inspectCodeqlReport,
  scopeCodeqlReport,
  admitReviewedCodeqlReport,
} from "../security/codeql-report.ts";

if (process.argv.length > 2)
  throw new Error(
    "CodeQL checks the full configured scope and accepts no arguments.",
  );
const executable = resolve(codeqlRoot(), "codeql/codeql");
const root = resolve(".tmp/codeql");
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });
await runQaWrapper("qa:codeql", async ({ run, writeStdout }) => {
  await run("CodeQL identity", executable, [
    "version",
    "--format=json",
    `--common-caches=${resolve(".tmp/codeql-cache")}`,
  ]);
  await run("CodeQL extraction", executable, [
    "database",
    "create",
    resolve(root, "database"),
    "--language=javascript-typescript",
    "--source-root",
    process.cwd(),
    "--codescanning-config=tooling/configs/codeql/config.yml",
    "--threads=2",
    "--ram=4096",
    `--common-caches=${resolve(".tmp/codeql-cache")}`,
  ]);
  await run("CodeQL security and quality", executable, [
    "database",
    "analyze",
    resolve(root, "database"),
    readCodeqlToolchain().querySuite,
    "--format=sarif-latest",
    `--output=${resolve(root, "raw.sarif")}`,
    "--threads=2",
    "--ram=4096",
    `--common-caches=${resolve(".tmp/codeql-cache")}`,
  ]);
  const raw: unknown = JSON.parse(
    readFileSync(resolve(root, "raw.sarif"), "utf8"),
  );
  const scoped = scopeCodeqlReport(raw);
  writeFileSync(resolve(root, "scoped.sarif"), `${JSON.stringify(scoped)}\n`, {
    mode: 0o600,
  });
  const { report, consumedNoise } = admitReviewedCodeqlReport(
    scoped,
    readRegistry(),
  );
  writeFileSync(
    resolve(root, "review-decisions.json"),
    `${JSON.stringify({ consumedNoise })}\n`,
    { mode: 0o600 },
  );
  writeStdout(
    `CodeQL exact tool-noise decisions: ${consumedNoise.join(", ") || "none"}\n`,
  );
  writeFileSync(resolve(root, "results.sarif"), `${JSON.stringify(report)}\n`, {
    mode: 0o600,
  });
  const findings = inspectCodeqlReport(report);
  if (findings.length) throw new Error(findings.join("\n"));
});
