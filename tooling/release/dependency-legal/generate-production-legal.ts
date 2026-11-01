import { prepareLegalOutput } from "./output.ts";
import type { LegalOutputOptions } from "./model.ts";
import { diagnosticValue } from "../../../src/sdk/diagnostic-value.js";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { privateReportDirectory, writePrivateFile } from "./boundary.ts";
import { publishLegalBundle } from "./materials.ts";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

export async function runProductionLegalGeneration(
  options: LegalOutputOptions = {},
) {
  const { root, output, settings, bundle } = await prepareLegalOutput(options);
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
    .catch((error: unknown) => {
      console.error(
        error instanceof Error ? error.message : diagnosticValue(error),
      );
      process.exitCode = 1;
    });
}
