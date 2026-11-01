import { prepareLegalOutput } from "./output.ts";
import type { LegalOutputOptions } from "./model.ts";
import { diagnosticValue } from "../../../src/sdk/diagnostic-value.js";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { privateReportDirectory, writePrivateFile } from "./boundary.ts";
import { compareLegalBundle } from "./materials.ts";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

export async function runProductionLegalValidation(
  options: LegalOutputOptions = {},
) {
  const { root, output, settings, bundle } = await prepareLegalOutput(options);
  const findings = await compareLegalBundle({ bundle, outputRoot: output });
  const report = {
    schemaVersion: 1,
    status: findings.length === 0 ? "passed" : "failed",
    packageCount: bundle.entries.length,
    findings,
  };
  const reports = await privateReportDirectory(root, settings.reportDirectory);
  await writePrivateFile(
    reports,
    "production-closure-validation.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await writePrivateFile(
    reports,
    "production-closure-validation.log",
    `${[
      `result=${report.status}`,
      `production-packages=${report.packageCount}`,
      ...findings.map((finding) => `issue.${finding.code}=${finding.target}`),
    ].join("\n")}\n`,
  );
  if (findings.length > 0)
    throw new Error(
      `Generated dependency legal material differs at ${findings.length} checked target(s); private details were written under ${settings.reportDirectory}.`,
    );
  return report;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const repoRoot = path.resolve(option("--repo-root") ?? process.cwd());
  const outputRoot = path.resolve(repoRoot, option("--output") ?? ".");
  runProductionLegalValidation({ repoRoot, outputRoot })
    .then((report) =>
      console.log(
        `Verified byte-exact legal material for ${report.packageCount} production packages.`,
      ),
    )
    .catch((error: unknown) => {
      console.error(
        error instanceof Error ? error.message : diagnosticValue(error),
      );
      process.exitCode = 1;
    });
}
