import {
  makeFindingScope,
  matchingNoise,
  requireConsumedNoise,
  type ReviewEntry,
} from "../policy/technical-debt/registry.ts";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid CodeQL SARIF object.");
  return value as Record<string, unknown>;
}
function resultRecord(value: unknown) {
  const result = record(value);
  const message = record(result.message);
  if (
    typeof result.ruleId !== "string" ||
    !result.ruleId ||
    typeof message.text !== "string" ||
    !message.text ||
    !Array.isArray(result.locations) ||
    !result.locations.length
  )
    throw new Error("Invalid CodeQL finding.");
  const locations: readonly unknown[] = result.locations;
  const ownership = locations.map((value) => {
    const physical = record(record(value).physicalLocation);
    const uri = record(physical.artifactLocation).uri;
    if (typeof uri !== "string" || !uri)
      throw new Error("Invalid CodeQL source URI.");
    const file = decodeURIComponent(uri);
    if (
      file.startsWith("/") ||
      /[:\\]/u.test(file) ||
      file.split("/").some((part) => part === "..")
    )
      throw new Error("CodeQL source URI escapes its root.");
    return (
      /^(?:src|tooling)\//u.test(file) && !/\.(?:test|spec)\.ts$/u.test(file)
    );
  });
  return {
    result,
    owned: ownership.some(Boolean),
    text: `${result.ruleId}: ${message.text}`,
  };
}
export function scopeCodeqlReport(value: unknown): Record<string, unknown> {
  const root = record(value);
  if (
    root.version !== "2.1.0" ||
    !Array.isArray(root.runs) ||
    !root.runs.length
  )
    throw new Error("CodeQL must produce a nonempty SARIF 2.1.0 run.");
  const runs: readonly unknown[] = root.runs;
  return {
    ...root,
    runs: runs.map((value) => {
      const run = record(value);
      const tool = record(run.tool);
      if (
        record(tool.driver).name !== "CodeQL" ||
        !Array.isArray(run.results) ||
        !Array.isArray(run.invocations) ||
        !run.invocations.length
      )
        throw new Error("CodeQL SARIF run is incomplete.");
      const invocations: readonly unknown[] = run.invocations;
      if (invocations.some((item) => record(item).executionSuccessful !== true))
        throw new Error("CodeQL analysis did not complete successfully.");
      const results: readonly unknown[] = run.results;
      return {
        ...run,
        results: results
          .map(resultRecord)
          .filter((item) => item.owned)
          .map((item) => item.result),
      };
    }),
  };
}
export function inspectCodeqlReport(value: unknown): string[] {
  const scoped = scopeCodeqlReport(value);
  if (!Array.isArray(scoped.runs)) throw new Error("Invalid CodeQL runs.");
  const runs: readonly unknown[] = scoped.runs;
  return runs.flatMap((value) => {
    const run = record(value);
    if (!Array.isArray(run.results)) throw new Error("Invalid CodeQL results.");
    const results: readonly unknown[] = run.results;
    return results.map((item) => resultRecord(item).text);
  });
}
export function admitReviewedCodeqlReport(
  value: unknown,
  entries: readonly ReviewEntry[],
  root = process.cwd(),
): { report: Record<string, unknown>; consumedNoise: string[] } {
  const scoped = scopeCodeqlReport(value);
  const consumedNoise: string[] = [];
  if (!Array.isArray(scoped.runs)) throw new Error("Invalid CodeQL runs.");
  const runs: readonly unknown[] = scoped.runs;
  const report = {
    ...scoped,
    runs: runs.map((value) => {
      const run = record(value);
      if (!Array.isArray(run.results))
        throw new Error("Invalid CodeQL results.");
      const results: readonly unknown[] = run.results;
      return {
        ...run,
        results: results.filter((value) => {
          const finding = record(value);
          const message = record(finding.message);
          if (!Array.isArray(finding.locations))
            throw new Error("Invalid CodeQL locations.");
          const physical = record(
            record(finding.locations[0]).physicalLocation,
          );
          const artifact = record(physical.artifactLocation);
          const region = record(physical.region);
          if (
            typeof artifact.uri !== "string" ||
            typeof region.startLine !== "number" ||
            !Number.isInteger(region.startLine) ||
            region.startLine < 1 ||
            typeof region.startColumn !== "number" ||
            !Number.isInteger(region.startColumn) ||
            region.startColumn < 1 ||
            typeof finding.ruleId !== "string" ||
            typeof message.text !== "string"
          )
            throw new Error("Invalid CodeQL finding scope.");
          const scope = makeFindingScope(
            decodeURIComponent(artifact.uri),
            region.startLine,
            region.startColumn,
            finding.ruleId,
            message.text,
            finding,
            root,
          );
          const noise = matchingNoise(entries, "codeql", scope);
          if (!noise) return true;
          consumedNoise.push(noise.id);
          return false;
        }),
      };
    }),
  };
  requireConsumedNoise(entries, "codeql", new Set(consumedNoise));
  return { report, consumedNoise };
}
