import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, expect, it } from "vitest";
import { inspectWritingReport } from "../../documentation/ste.ts";
import {
  admitReviewedCodeqlReport,
  inspectCodeqlReport,
} from "../../security/codeql-report.ts";
import {
  makeFindingScope,
  parseRegistry,
  sha256,
  toolIdentity,
} from "./registry.ts";

const roots: string[] = [];
function fixture(kind: "ste" | "codeql") {
  mkdirSync(resolve(".tmp/review-admission"), { recursive: true });
  const root = mkdtempSync(resolve(".tmp/review-admission/case-"));
  roots.push(root);
  const files = {
    "README.md": "Validation and user confirmation differ.",
    "src/input.ts": "const input = true;",
    "src/server.ts": "trusted root",
    "tests/evidence.ts": "focused evidence",
    ".agents/skills/asd-ste100/scripts/ste-lint.py": "native checker",
    "tooling/configs/codeql/toolchain.json": "pinned bundle",
  };
  for (const [file, text] of Object.entries(files)) {
    const absolute = join(root, file);
    mkdirSync(resolve(absolute, ".."), { recursive: true });
    writeFileSync(absolute, text);
  }
  const file = kind === "ste" ? "README.md" : "src/input.ts";
  const finding =
    kind === "ste"
      ? {
          file,
          line: 1,
          col: 1,
          rule: "synonym-rotation",
          message: "distinct domain operations",
          match: "validation",
          level: "advisory-free",
        }
      : {
          ruleId: "js/path-injection",
          message: { text: "fixture" },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: file },
                region: { startLine: 1, startColumn: 1 },
              },
            },
          ],
          codeFlows: [
            {
              threadFlows: [
                {
                  locations: [
                    { location: { message: { text: "original trace" } } },
                  ],
                },
              ],
            },
          ],
        };
  const scope = makeFindingScope(
    file,
    1,
    1,
    kind === "ste" ? "synonym-rotation" : "js/path-injection",
    kind === "ste" ? "distinct domain operations" : "fixture",
    finding,
    root,
  );
  const common = {
    id: `noise.${kind}.exact`,
    classification: "tool-noise",
    owner: "repository-owner",
    reason: "The exact input is a proven false positive.",
    risk: "A broader match could hide a defect.",
    targetAction: "Retain exact proof.",
    removalCondition: "Remove on source or tool changes.",
    reviewBy: "2027-02-01",
    evidence: ["tests/evidence.ts"],
  };
  const registry = {
    schemaVersion: 1,
    entries: [
      {
        ...common,
        source: { kind, identity: toolIdentity(kind, root) },
        scope,
        context: [
          { file: "src/server.ts", contentHash: sha256("trusted root") },
        ],
      },
    ],
  };
  const entries = parseRegistry(registry, root, new Date("2026-11-01"));
  return { root, finding, entries, common };
}
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
it("admits only an exact reviewed writing finding and blocks a different message", () => {
  const { root, finding, entries } = fixture("ste");
  expect(
    inspectWritingReport(
      { hard_count: 1, violations: [finding] },
      { root, entries },
    ),
  ).toMatchObject({ blockers: [], consumedNoise: ["noise.ste.exact"] });
  expect(
    inspectWritingReport(
      { hard_count: 1, violations: [{ ...finding, message: "new ambiguity" }] },
      { root, entries },
    ).blockers,
  ).toHaveLength(1);
});
it("binds the complete CodeQL trace and keeps real debt from waiving a finding", () => {
  const { root, finding, entries, common } = fixture("codeql");
  const report = (result: unknown) => ({
    version: "2.1.0",
    runs: [
      {
        tool: { driver: { name: "CodeQL" } },
        invocations: [{ executionSuccessful: true }],
        results: [result],
      },
    ],
  });
  const admitted = admitReviewedCodeqlReport(report(finding), entries, root);
  expect(admitted.consumedNoise).toEqual(["noise.codeql.exact"]);
  expect(inspectCodeqlReport(admitted.report)).toEqual([]);
  expect(() =>
    admitReviewedCodeqlReport(
      report({ ...finding, codeFlows: [] }),
      entries,
      root,
    ),
  ).toThrow("Obsolete");
  const debt = parseRegistry(
    {
      schemaVersion: 1,
      entries: [
        {
          ...common,
          id: "debt.existing",
          classification: "debt",
          source: { file: "src/input.ts", line: 1 },
        },
      ],
    },
    root,
    new Date("2026-11-01"),
  );
  expect(
    inspectCodeqlReport(
      admitReviewedCodeqlReport(report(finding), debt, root).report,
    ),
  ).toEqual(["js/path-injection: fixture"]);
});
