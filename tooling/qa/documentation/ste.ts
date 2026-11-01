import {
  readRegistry,
  matchingNoise,
  makeFindingScope,
  requireConsumedNoise,
  type ReviewEntry,
} from "../policy/technical-debt/registry.ts";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { git } from "../workflow/candidate.ts";

export function inspectWritingReport(
  value: unknown,
  policy?: { entries: readonly ReviewEntry[]; root?: string },
): {
  blockers: string[];
  suggestions: number;
  consumedNoise: string[];
} {
  if (
    !value ||
    typeof value !== "object" ||
    !("violations" in value) ||
    !Array.isArray(value.violations)
  )
    throw new Error("Invalid STE report.");
  if (
    !("hard_count" in value) ||
    typeof value.hard_count !== "number" ||
    !Number.isInteger(value.hard_count) ||
    value.hard_count < 0
  )
    throw new Error("Invalid STE hard count.");
  const violations: readonly unknown[] = value.violations;
  const blockers: string[] = [];
  let suggestions = 0;
  const consumedNoise: string[] = [];
  for (const item of violations) {
    if (
      !item ||
      typeof item !== "object" ||
      !("rule" in item) ||
      typeof item.rule !== "string" ||
      !("level" in item) ||
      typeof item.level !== "string" ||
      !("file" in item) ||
      typeof item.file !== "string" ||
      !("line" in item) ||
      typeof item.line !== "number" ||
      !("col" in item) ||
      typeof item.col !== "number" ||
      !Number.isInteger(item.col) ||
      item.col < 1 ||
      !("match" in item) ||
      typeof item.match !== "string" ||
      !("message" in item) ||
      typeof item.message !== "string"
    )
      throw new Error("Invalid STE finding.");
    if (
      (item.level !== "advisory-free" && item.level !== "advisory") ||
      !Number.isInteger(item.line) ||
      item.line < 1
    )
      throw new Error("Invalid STE finding level or location.");
    if (item.level === "advisory") suggestions += 1;
    else {
      const noise = policy
        ? matchingNoise(
            policy.entries,
            "ste",
            makeFindingScope(
              item.file,
              item.line,
              item.col,
              item.rule,
              item.message,
              item,
              policy.root,
            ),
          )
        : undefined;
      if (noise) consumedNoise.push(noise.id);
      else blockers.push(`${item.file}:${item.line}: ${item.message}`);
    }
  }
  const hard = violations.filter(
    (item) =>
      item !== null &&
      typeof item === "object" &&
      "level" in item &&
      item.level === "advisory-free",
  ).length;
  if (hard !== value.hard_count) throw new Error("Invalid STE hard count.");
  return { blockers, suggestions, consumedNoise };
}

export function checkDocumentation(): void {
  const files = [
    ...new Set(
      git(process.cwd(), [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
      ]).split("\0"),
    ),
  ]
    .filter(
      (file) =>
        /^(?:AGENTS|README|CONTRIBUTING|SECURITY)\.md$/u.test(file) ||
        /^docs\/.*\.md$/u.test(file) ||
        /^\.agents\/skills\/.*\.md$/u.test(file),
    )
    .filter((file) => existsSync(file))
    .sort();
  if (files.length === 0) throw new Error("Documentation scope is empty.");
  for (const file of files)
    assertEnglishProse(readFileSync(file, "utf8"), file);
  const entries = readRegistry();
  const result = spawnSync(
    process.platform === "win32" ? "python" : "python3",
    [".agents/skills/asd-ste100/scripts/ste-lint.py", "--json", ...files],
    { encoding: "utf8", timeout: 120000, maxBuffer: 16 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  if (result.signal || (result.status !== 0 && result.status !== 1))
    throw new Error(`STE checker did not complete: ${result.stderr}`);
  const report: unknown = JSON.parse(result.stdout);
  const { blockers, suggestions, consumedNoise } = inspectWritingReport(
    report,
    { entries },
  );
  if (
    !report ||
    typeof report !== "object" ||
    !("hard_count" in report) ||
    result.status !== (Number(report.hard_count) > 0 ? 1 : 0)
  )
    throw new Error("STE exit status disagrees with its report.");
  mkdirSync(resolve(".tmp/documentation"), { recursive: true });
  writeFileSync(resolve(".tmp/documentation/ste.json"), result.stdout, {
    mode: 0o600,
  });
  if (blockers.length) throw new Error(blockers.join("\n"));
  requireConsumedNoise(entries, "ste", new Set(consumedNoise));
  process.stdout.write(
    `Writing structure passed: ${files.length} authored documents. ${consumedNoise.length} exact tool-noise decisions. ${suggestions} advisory suggestions require semantic review.\n`,
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
)
  checkDocumentation();

export function assertEnglishProse(source: string, file: string): void {
  let fence: { marker: string; length: number; line: number } | undefined;
  for (const [index, line] of source.split(/\r?\n/u).entries()) {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
    const marker = match?.[1];
    if (marker) {
      if (!fence) {
        fence = {
          marker: marker[0] ?? "",
          length: marker.length,
          line: index + 1,
        };
        continue;
      }
      if (
        marker[0] === fence.marker &&
        marker.length >= fence.length &&
        !match?.[2]?.trim()
      ) {
        fence = undefined;
        continue;
      }
    }
    if (!fence && /[\p{Script=Cyrillic}]/u.test(line.replace(/`[^`]*`/gu, "")))
      throw new Error(
        `${file}:${index + 1}: Authored prose must use English. Put localized data in code examples.`,
      );
  }
  if (fence)
    throw new Error(`${file}:${fence.line}: Unterminated Markdown code fence.`);
}
