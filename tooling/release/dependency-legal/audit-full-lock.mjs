import path from "node:path";
import { pathToFileURL } from "node:url";

import { privateReportDirectory, writePrivateFile } from "./boundary.mjs";
import { inspectLegalState } from "./compliance.mjs";

function auditLog(report) {
  const lines = [
    `result=${report.status}`,
    `locked-packages=${report.packageCount}`,
  ];
  for (const [scope, count] of Object.entries(report.scopeCounts))
    lines.push(`scope.${scope}=${count}`);
  for (const [license, count] of Object.entries(report.licenseCounts))
    lines.push(`spdx.${license}=${count}`);
  for (const finding of report.findings)
    lines.push(
      `issue.${finding.code}=${finding.packagePath ?? "project"}: ${finding.summary}`,
    );
  return `${lines.join("\n")}\n`;
}

export async function auditFullLock(options = {}) {
  const {
    settings: _settings,
    packages: _packages,
    ...report
  } = await inspectLegalState(options);
  return report;
}

export async function runFullLockAudit(options = {}) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const state = await inspectLegalState({ ...options, repoRoot });
  const { settings, packages: _packages, ...report } = state;
  const reportDirectory = await privateReportDirectory(
    repoRoot,
    settings.reportDirectory,
  );
  await writePrivateFile(
    reportDirectory,
    "full-lock-audit.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await writePrivateFile(
    reportDirectory,
    "full-lock-audit.log",
    auditLog(report),
  );
  if (report.status === "failed")
    throw new Error(
      `Dependency license inventory has ${report.findings.length} compliance finding(s); private details were written under ${settings.reportDirectory}.`,
    );
  return report;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runFullLockAudit()
    .then((report) =>
      console.log(
        `Dependency license inventory accepted: ${report.packageCount} package records.`,
      ),
    )
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
