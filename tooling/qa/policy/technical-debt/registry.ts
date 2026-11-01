import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { stableSerialize } from "../../../../src/shared/serialization/stable-json.js";

export const REGISTRY_PATH = "tooling/configs/qa/technical-debt.data.json";
export const REPORT_PATH = "docs/engineering/tech-debt-report.md";
export type ToolKind = "ste" | "codeql";
export type FindingScope = {
  file: string;
  line: number;
  column: number;
  rule: string;
  contentHash: string;
  messageHash: string;
  findingHash: string;
};
type Common = {
  id: string;
  owner: string;
  reason: string;
  risk: string;
  targetAction: string;
  removalCondition: string;
  reviewBy: string;
  evidence: string[];
};
export type DebtEntry = Common & {
  classification: "debt";
  source: { file: string; line: number };
};
export type NoiseEntry = Common & {
  classification: "tool-noise";
  source: { kind: ToolKind; identity: string };
  scope: FindingScope;
  context: { file: string; contentHash: string }[];
};
export type ReviewEntry = DebtEntry | NoiseEntry;
const commonKeys = [
  "id",
  "classification",
  "owner",
  "reason",
  "risk",
  "targetAction",
  "removalCondition",
  "reviewBy",
  "evidence",
  "source",
];
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Review registry requires an object.");
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0"))
    throw new Error(
      "Review registry fields must match their declared contract.",
    );
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error("Review registry text must be nonempty.");
  return value;
}
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new Error("Review registry location must be a positive integer.");
  return value;
}
function digest(value: unknown): string {
  const result = text(value);
  if (!/^[a-f0-9]{64}$/u.test(result))
    throw new Error("Review registry requires an exact SHA-256.");
  return result;
}
function path(value: unknown): string {
  const file = text(value);
  if (
    isAbsolute(file) ||
    /[\\:*?[\]]/u.test(file) ||
    file.split("/").some((part) => !part || part === "." || part === "..") ||
    file.startsWith(".tmp/") ||
    file.startsWith(".git/")
  )
    throw new Error("Review registry requires an exact repository path.");
  return file;
}
export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
export function toolIdentity(kind: ToolKind, root = process.cwd()): string {
  return sha256(
    readFileSync(
      resolve(
        root,
        kind === "ste"
          ? ".agents/skills/asd-ste100/scripts/ste-lint.py"
          : "tooling/configs/codeql/toolchain.json",
      ),
    ),
  );
}
export function makeFindingScope(
  file: string,
  line: number,
  column: number,
  rule: string,
  message: string,
  finding: unknown,
  root = process.cwd(),
): FindingScope {
  return {
    file,
    line,
    column,
    rule,
    contentHash: sha256(readFileSync(resolve(root, path(file)))),
    messageHash: sha256(message),
    findingHash: sha256(stableSerialize(finding)),
  };
}
export function parseRegistry(
  value: unknown,
  root = process.cwd(),
  now = new Date(),
): ReviewEntry[] {
  const input = object(value);
  exact(input, ["schemaVersion", "entries"]);
  if (input.schemaVersion !== 1 || !Array.isArray(input.entries))
    throw new Error("Invalid review registry version or entries.");
  const entries: readonly unknown[] = input.entries;
  const ids = new Set<string>();
  return entries.map((value): ReviewEntry => {
    const entry = object(value);
    const noise = entry.classification === "tool-noise";
    if (!noise && entry.classification !== "debt")
      throw new Error(
        "Review registry classification must be debt or tool-noise.",
      );
    exact(entry, noise ? [...commonKeys, "scope", "context"] : commonKeys);
    const id = text(entry.id);
    if (
      !/^(?:noise|debt)\.[a-z0-9.-]+$/u.test(id) ||
      !id.startsWith(noise ? "noise." : "debt.") ||
      ids.has(id)
    )
      throw new Error("Review registry IDs must be unique and classified.");
    ids.add(id);
    const reviewBy = text(entry.reviewBy);
    if (
      !/^\d{4}-\d{2}-\d{2}$/u.test(reviewBy) ||
      !Number.isFinite(Date.parse(reviewBy)) ||
      new Date(reviewBy).toISOString().slice(0, 10) !== reviewBy ||
      reviewBy < now.toISOString().slice(0, 10)
    )
      throw new Error(`Review date is invalid or expired: ${id}`);
    if (!Array.isArray(entry.evidence) || entry.evidence.length === 0)
      throw new Error("Review registry requires permanent evidence paths.");
    const evidence: readonly unknown[] = entry.evidence;
    const common: Common = {
      id,
      owner: text(entry.owner),
      reason: text(entry.reason),
      risk: text(entry.risk),
      targetAction: text(entry.targetAction),
      removalCondition: text(entry.removalCondition),
      reviewBy,
      evidence: evidence.map(path),
    };
    for (const file of common.evidence) readFileSync(resolve(root, file));
    const source = object(entry.source);
    if (!noise) {
      exact(source, ["file", "line"]);
      return {
        ...common,
        classification: "debt",
        source: { file: path(source.file), line: integer(source.line) },
      };
    }
    exact(source, ["kind", "identity"]);
    if (source.kind !== "ste" && source.kind !== "codeql")
      throw new Error("Unsupported tool-noise source.");
    const identity = digest(source.identity);
    if (identity !== toolIdentity(source.kind, root))
      throw new Error(`Tool identity changed: ${id}`);
    const scope = object(entry.scope);
    exact(scope, [
      "file",
      "line",
      "column",
      "rule",
      "contentHash",
      "messageHash",
      "findingHash",
    ]);
    const parsedScope: FindingScope = {
      file: path(scope.file),
      line: integer(scope.line),
      column: integer(scope.column),
      rule: text(scope.rule),
      contentHash: digest(scope.contentHash),
      messageHash: digest(scope.messageHash),
      findingHash: digest(scope.findingHash),
    };
    if (parsedScope.file === REPORT_PATH || /[*?]/u.test(parsedScope.rule))
      throw new Error(
        "Tool noise cannot waive its own report or a rule pattern.",
      );
    if (
      sha256(readFileSync(resolve(root, parsedScope.file))) !==
      parsedScope.contentHash
    )
      throw new Error(`Tool-noise source changed: ${id}`);
    if (!Array.isArray(entry.context))
      throw new Error("Tool-noise context must be explicit.");
    if (source.kind === "codeql" && entry.context.length === 0)
      throw new Error("CodeQL tool noise requires explicit caller context.");
    const contexts: readonly unknown[] = entry.context;
    const context = contexts.map((value) => {
      const item = object(value);
      exact(item, ["file", "contentHash"]);
      const file = path(item.file);
      const contentHash = digest(item.contentHash);
      if (sha256(readFileSync(resolve(root, file))) !== contentHash)
        throw new Error(`Tool-noise context changed: ${id}`);
      return { file, contentHash };
    });
    return {
      ...common,
      classification: "tool-noise",
      source: { kind: source.kind, identity },
      scope: parsedScope,
      context,
    };
  });
}
export function readRegistry(root = process.cwd()): ReviewEntry[] {
  const value: unknown = JSON.parse(
    readFileSync(resolve(root, REGISTRY_PATH), "utf8"),
  );
  return parseRegistry(value, root);
}
export function matchingNoise(
  entries: readonly ReviewEntry[],
  kind: ToolKind,
  scope: FindingScope,
): NoiseEntry | undefined {
  return entries.find(
    (entry): entry is NoiseEntry =>
      entry.classification === "tool-noise" &&
      entry.source.kind === kind &&
      stableSerialize(entry.scope) === stableSerialize(scope),
  );
}
export function requireConsumedNoise(
  entries: readonly ReviewEntry[],
  kind: ToolKind,
  consumed: ReadonlySet<string>,
): void {
  for (const entry of entries)
    if (
      entry.classification === "tool-noise" &&
      entry.source.kind === kind &&
      !consumed.has(entry.id)
    )
      throw new Error(
        `Obsolete tool noise must be removed or reviewed: ${entry.id}`,
      );
}
