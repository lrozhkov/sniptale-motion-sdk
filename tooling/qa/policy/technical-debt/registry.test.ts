import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  makeFindingScope,
  matchingNoise,
  parseRegistry,
  requireConsumedNoise,
  sha256,
  toolIdentity,
  type ReviewEntry,
} from "./registry.ts";

const roots: string[] = [];
function fixture() {
  mkdirSync(resolve(".tmp/registry-tests"), { recursive: true });
  const root = mkdtempSync(resolve(".tmp/registry-tests/case-"));
  roots.push(root);
  for (const file of [
    "README.md",
    "tests/evidence.ts",
    ".agents/skills/asd-ste100/scripts/ste-lint.py",
  ]) {
    const full = join(root, file);
    mkdirSync(resolve(full, ".."), { recursive: true });
    writeFileSync(full, file);
  }
  const finding = {
    file: "README.md",
    line: 1,
    col: 1,
    rule: "synonym-rotation",
    message: "different domain actions",
    match: "check",
    level: "advisory-free",
  };
  const scope = makeFindingScope(
    finding.file,
    finding.line,
    finding.col,
    finding.rule,
    finding.message,
    finding,
    root,
  );
  const entry = {
    id: "noise.ste.domain-actions",
    classification: "tool-noise",
    owner: "repository-owner",
    reason: "The names identify separate domain operations.",
    risk: "A broader exception could hide new ambiguity.",
    targetAction: "Retain exact scope and evidence.",
    removalCondition: "Remove when the rule handles distinct actions.",
    reviewBy: "2027-02-01",
    evidence: ["tests/evidence.ts"],
    source: { kind: "ste", identity: toolIdentity("ste", root) },
    scope,
    context: [],
  };
  return { root, finding, scope, entry };
}
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
describe("technical-debt and exact tool-noise registry", () => {
  it("admits one exact finding and rejects drift or unused decisions", () => {
    const { root, entry, scope } = fixture();
    const entries = parseRegistry(
      { schemaVersion: 1, entries: [entry] },
      root,
      new Date("2026-11-01"),
    );
    expect(matchingNoise(entries, "ste", scope)?.id).toBe(entry.id);
    expect(
      matchingNoise(entries, "ste", { ...scope, line: 2 }),
    ).toBeUndefined();
    expect(
      matchingNoise(entries, "ste", { ...scope, messageHash: "0".repeat(64) }),
    ).toBeUndefined();
    expect(
      matchingNoise(entries, "ste", { ...scope, findingHash: "0".repeat(64) }),
    ).toBeUndefined();
    expect(() => requireConsumedNoise(entries, "ste", new Set())).toThrow(
      "Obsolete",
    );
    expect(() =>
      requireConsumedNoise(entries, "ste", new Set([entry.id])),
    ).not.toThrow();
    writeFileSync(join(root, "README.md"), "changed");
    expect(() =>
      parseRegistry(
        { schemaVersion: 1, entries: [entry] },
        root,
        new Date("2026-11-01"),
      ),
    ).toThrow("source changed");
  });
  it("rejects patterns, expired reviews, unknown fields and changed tools", () => {
    const { root, entry } = fixture();
    for (const replacement of [
      { reviewBy: "2026-10-01" },
      { reviewBy: "2027-02-31" },
      { scope: { ...entry.scope, file: "docs/*.md" } },
      { scope: { ...entry.scope, rule: "*" } },
      { extra: true },
      { source: { ...entry.source, identity: "0".repeat(64) } },
    ])
      expect(() =>
        parseRegistry(
          { schemaVersion: 1, entries: [{ ...entry, ...replacement }] },
          root,
          new Date("2026-11-01"),
        ),
      ).toThrow(/registry|Review|Tool|tool|path|pattern|fields/u);
  });
  it("keeps real debt out of the finding-admission path", () => {
    const { root, entry, scope } = fixture();
    const { scope: _scope, context: _context, ...common } = entry;
    const entries: ReviewEntry[] = parseRegistry(
      {
        schemaVersion: 1,
        entries: [
          {
            ...common,
            id: "debt.existing-defect",
            classification: "debt",
            source: { file: "README.md", line: 1 },
          },
        ],
      },
      root,
      new Date("2026-11-01"),
    );
    expect(matchingNoise(entries, "ste", scope)).toBeUndefined();
    expect(entries[0]?.classification).toBe("debt");
  });
  it("binds additional caller context", () => {
    const { root, entry } = fixture();
    const context = {
      file: "tests/evidence.ts",
      contentHash: sha256(readFileSync(join(root, "tests/evidence.ts"))),
    };
    const registry = {
      schemaVersion: 1,
      entries: [{ ...entry, context: [context] }],
    };
    expect(() =>
      parseRegistry(registry, root, new Date("2026-11-01")),
    ).not.toThrow();
    writeFileSync(join(root, context.file), "different authority");
    expect(() => parseRegistry(registry, root, new Date("2026-11-01"))).toThrow(
      "context changed",
    );
  });
});
