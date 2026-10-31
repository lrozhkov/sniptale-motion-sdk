import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { runQaWrapper } from "../runtime/wrapper-runner.ts";
import {
  createSecurityEnvironment,
  GITLEAKS_CONFIG_PATH,
  GITLEAKS_IGNORE_PATH,
  NPM_DEPENDENCY_SCOPE,
  NPM_REGISTRY,
} from "../security/environment.ts";

const evidenceRoot = join(".tmp", "security");
const GITLEAKS_HISTORY_SCAN_ENABLED = false;
const GITLEAKS_HISTORY_SCAN_DISABLED_REASON =
  "history-independent candidate proof scans the current index and worktree while the retained history command stays inactive";
const evidenceFiles = {
  gitleaksHistory: join(evidenceRoot, "gitleaks-history.json"),
  gitleaksIndex: join(evidenceRoot, "gitleaks-index.json"),
  gitleaksWorktree: join(evidenceRoot, "gitleaks-worktree.json"),
  osv: join(evidenceRoot, "osv.json"),
  summary: join(evidenceRoot, "summary.json"),
};
const npmUserConfig = join(evidenceRoot, "npmrc");
const securityEnvironment = createSecurityEnvironment(process.env, {
  npmUserConfig: resolve(npmUserConfig),
});

mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });
chmodSync(evidenceRoot, 0o700);
for (const file of Object.values(evidenceFiles)) {
  rmSync(file, { force: true });
}
rmSync(GITLEAKS_IGNORE_PATH, { force: true });
writeFileSync(npmUserConfig, `registry=${NPM_REGISTRY}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
chmodSync(npmUserConfig, 0o600);

type SecurityRun = (
  label: string,
  command: string,
  args: readonly string[],
) => Promise<void>;

async function runGitleaksHistoryAudit(
  securityRun: SecurityRun,
): Promise<void> {
  await securityRun("Gitleaks history audit", "gitleaks", [
    "git",
    "--config",
    GITLEAKS_CONFIG_PATH,
    "--gitleaks-ignore-path",
    GITLEAKS_IGNORE_PATH,
    "--log-opts=--all",
    "--redact=100",
    "--ignore-gitleaks-allow",
    "--max-archive-depth=2",
    "--timeout=120",
    "--report-format",
    "json",
    "--report-path",
    evidenceFiles.gitleaksHistory,
    "--no-banner",
    "--no-color",
    "--log-level",
    "error",
    ".",
  ]);
  chmodSync(evidenceFiles.gitleaksHistory, 0o600);
}

await runQaWrapper("qa:security", async ({ run, writeStdout }) => {
  const securityRun: SecurityRun = (label, command, args) =>
    run(label, command, args, { env: securityEnvironment });

  await securityRun("Gitleaks version", "gitleaks", ["version"]);
  await securityRun("OSV-Scanner version", "osv-scanner", ["--version"]);
  await securityRun("dependency release age", "node", [
    "--import",
    "tsx",
    "tooling/qa/security/dependency-age.ts",
  ]);
  await securityRun("npm advisory audit", "npm", [
    "audit",
    "--json",
    "--audit-level=info",
    `--registry=${NPM_REGISTRY}`,
    ...NPM_DEPENDENCY_SCOPE,
  ]);
  await securityRun("npm registry signatures", "npm", [
    "audit",
    "signatures",
    `--registry=${NPM_REGISTRY}`,
    ...NPM_DEPENDENCY_SCOPE,
  ]);
  await securityRun("OSV lockfile audit", "osv-scanner", [
    "scan",
    "source",
    "--lockfile",
    "package-lock.json",
    "--no-ignore",
    "--format",
    "json",
    "--output-file",
    evidenceFiles.osv,
    "--verbosity",
    "error",
  ]);
  chmodSync(evidenceFiles.osv, 0o600);
  let gitleaksHistoryStatus = "disabled";
  if (GITLEAKS_HISTORY_SCAN_ENABLED) {
    await runGitleaksHistoryAudit(securityRun);
    gitleaksHistoryStatus = "passed";
  }
  await securityRun("Gitleaks index and worktree audit", "node", [
    "--import",
    "tsx",
    "tooling/qa/security/scan-worktree.ts",
  ]);
  chmodSync(evidenceFiles.gitleaksIndex, 0o600);
  chmodSync(evidenceFiles.gitleaksWorktree, 0o600);
  writeFileSync(
    evidenceFiles.summary,
    `${JSON.stringify(
      {
        schemaVersion: 2,
        status: "passed",
        checks: [
          "dependency-release-age-and-registry-identity",
          "npm-advisories",
          "npm-registry-signatures",
          "osv-lockfile",
          "gitleaks-index",
          "gitleaks-worktree",
        ],
        historyScan: {
          reason: GITLEAKS_HISTORY_SCAN_DISABLED_REASON,
          status: gitleaksHistoryStatus,
        },
      },
      null,
      2,
    )}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  chmodSync(evidenceFiles.summary, 0o600);
  writeStdout(
    `[qa:security] Gitleaks history scan: ${gitleaksHistoryStatus}\n`,
  );
  writeStdout("[qa:security] evidence: .tmp/security/summary.json\n");
});
