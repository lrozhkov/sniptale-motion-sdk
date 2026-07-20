import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertContainedAbsolute,
  loadLegalSettings,
  privateReportDirectory,
  rejectSymlinkSegments,
  writePrivateFile,
} from "./boundary.mjs";
import { assembleLegalBundle, publishLegalBundle } from "./materials.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

export async function runProductionLegalGeneration({
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
  await publishLegalBundle({ bundle, outputRoot: output });
  const reports = await privateReportDirectory(root, settings.reportDirectory);
  await writePrivateFile(
    reports,
    "production-closure-generate.log",
    `result=passed\nproduction-packages=${bundle.entries.length}\noutput-root=${path.relative(root, output) || "."}\n`,
  );
  return bundle;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const repoRoot = path.resolve(option("--repo-root") ?? process.cwd());
  const outputRoot = path.resolve(repoRoot, option("--output") ?? ".");
  runProductionLegalGeneration({ repoRoot, outputRoot })
    .then((bundle) =>
      console.log(
        `Published byte-exact legal material for ${bundle.entries.length} production packages.`,
      ),
    )
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
