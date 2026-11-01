import { existsSync, readFileSync } from "node:fs";
import { changedFiles } from "../workflow/candidate.ts";
import { classifyScope } from "../workflow/scope.ts";
import { runQaWrapper } from "../runtime/wrapper-runner.ts";

const args = process.argv.slice(2);
const filesIndex = args.indexOf("--files");
const explicitFiles = filesIndex >= 0 ? args.slice(filesIndex + 1) : [];

function lineCount(file: string): number | null {
  if (!existsSync(file)) return null;
  return readFileSync(file, "utf8").split("\n").length;
}

await runQaWrapper("qa:preflight", async ({ writeStdout }) => {
  const targets = explicitFiles.length > 0 ? explicitFiles : changedFiles();
  const scope = classifyScope(targets);
  const docs = new Set([
    "AGENTS.md",
    "docs/architecture/repository-overview.md",
    "docs/tooling/code-quality.md",
  ]);
  if (targets.some((file) => file.includes("i18n") || file.endsWith(".html"))) {
    docs.add("docs/architecture/i18n-architecture.md");
  }

  const hotspots = targets
    .map((file) => ({ file, lines: lineCount(file) }))
    .filter(
      (entry): entry is { file: string; lines: number } =>
        entry.lines !== null && entry.lines >= 240,
    )
    .sort((a, b) => b.lines - a.lines);

  const lines = [
    "QA preflight: read-only context",
    "",
    `Target files (${targets.length}):`,
    ...targets.map((file) => `- ${file}`),
    "",
    "Relevant docs:",
    ...[...docs].map((doc) => `- ${doc}`),
    "",
    `Owners: ${scope.owners.join(", ")}`,
    `Required proof: ${scope.full ? "ci:proof (complete repository)" : scope.coverage ? "checkpoint, coverage" : "checkpoint"}`,
    "Review routing is advisory. Check the actual diff against each local review skill. Record each required review or its inapplicability reason.",
    "",
    "Line-count risks:",
    ...(hotspots.length === 0
      ? ["- none"]
      : hotspots
          .slice(0, 12)
          .map((entry) => `- ${entry.file}: ${entry.lines} lines`)),
  ];
  writeStdout(`${lines.join("\n")}\n`);
});
