import { readFileSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import {
  readRegistry,
  REGISTRY_PATH,
  REPORT_PATH,
  type ReviewEntry,
} from "./registry.ts";

export function renderRegistry(entries: readonly ReviewEntry[]): string {
  const link = (file: string) =>
    `[${file}](${relative(dirname(REPORT_PATH), file).replaceAll("\\", "/")})`;
  const lines = [
    "# Technical Debt and Tool Noise",
    "",
    `The [registry](${relative(dirname(REPORT_PATH), REGISTRY_PATH).replaceAll("\\", "/")}) owns these decisions. This report is generated. Change the registry. Regenerate the report in the same change.`,
    "",
    "A debt record never authorizes a failed check. Tool-noise admission requires an exact reviewed finding, source bytes, tool identity, evidence, owner, and removal condition. Changed or obsolete decisions fail QA.",
    "",
  ];
  for (const classification of ["debt", "tool-noise"] as const) {
    lines.push(
      classification === "debt"
        ? "## Deferred defects"
        : "## Proven tool noise",
      "",
    );
    const selected = entries.filter(
      (entry) => entry.classification === classification,
    );
    if (!selected.length)
      lines.push(
        classification === "debt"
          ? "This registry accepts no deferred defects."
          : "This registry accepts no tool-noise decisions.",
        "",
      );
    for (const entry of selected) {
      lines.push("### `" + entry.id + "`", "");
      const scope =
        entry.classification === "debt"
          ? `${entry.source.file}:${entry.source.line}`
          : `${entry.scope.file}:${entry.scope.line}:${entry.scope.column}`;
      lines.push(
        `Scope: \`${scope}\`. Owner: \`${entry.owner}\`. Review by \`${entry.reviewBy}\`.`,
        "",
        entry.reason,
        "",
        `Risk: ${entry.risk}`,
        "",
        `Required action: ${entry.targetAction}`,
        "",
        `Removal: ${entry.removalCondition}`,
        "",
        `Evidence: ${entry.evidence.map(link).join(", ")}.`,
        "",
      );
    }
  }
  lines.push(
    "## Verification limits",
    "",
    "Platform verification limits remain owned by [code quality](../tooling/code-quality.md). A platform limitation is not proof of a source defect or a tool false positive.",
    "",
  );
  return lines.join("\n");
}
export function checkRegistryReport(root = process.cwd()): void {
  const entries = readRegistry(root);
  if (
    readFileSync(resolve(root, REPORT_PATH), "utf8") !== renderRegistry(entries)
  )
    throw new Error(
      "Technical-debt report is stale. Regenerate it from its registry.",
    );
  process.stdout.write(
    `Review registry passed: ${entries.filter((entry) => entry.classification === "debt").length} debt records, ${entries.filter((entry) => entry.classification === "tool-noise").length} exact tool-noise decisions.\n`,
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
)
  checkRegistryReport();
