import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertContainedAbsolute,
  loadLegalSettings,
  privateReportDirectory,
  rejectSymlinkSegments,
  writePrivateFile,
} from "./boundary.mjs";
import { assembleLegalBundle, compareLegalBundle } from "./materials.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

export async function runProductionLegalValidation({
  repoRoot = process.cwd(),
  outputRoot = repoRoot,
  policyPath,
} = {}) {
  const root = path.resolve(repoRoot);
  const output = assertContainedAbsolute(root, outputRoot, "legal output root");
  const outputRelative = path.relative(root, output).split(path.sep).join("/");
  if (outputRelative !== "")
    await rejectSymlinkSegments(root, outputRelative, "legal output root");
  const settings = await loadLegalSettings(root, policyPath);
  const bundle = await assembleLegalBundle({
    repoRoot: root,
    settingsPath: policyPath,
  });
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
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
