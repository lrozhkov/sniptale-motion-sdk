import { createCandidateFixture } from "./test-support.ts";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { candidateDigest, changedFiles } from "./candidate.ts";
import { hasProof, recordProof, removeProof } from "./proof.ts";
import { classifyScope, parseCommitMessage } from "./scope.ts";

const roots: string[] = [];
function fixture() {
  const value = createCandidateFixture();
  roots.push(value.root);
  return value;
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("candidate-bound QA", () => {
  it("detects new Unicode paths, staged renames, deletes, and unstaged bytes", () => {
    const { root, git } = fixture();
    const before = candidateDigest(root);
    renameSync(join(root, "source.ts"), join(root, "новое имя.ts"));
    git("add", "--all");
    expect(changedFiles(root)).toEqual(["source.ts", "новое имя.ts"]);
    expect(candidateDigest(root)).not.toBe(before);
    const renamed = candidateDigest(root);
    writeFileSync(join(root, "новое имя.ts"), "changed");
    expect(candidateDigest(root)).not.toBe(renamed);
    rmSync(join(root, "новое имя.ts"));
    expect(() => candidateDigest(root)).not.toThrow();
  });
  it("invalidates receipts for modified inputs, tools, logs, and malformed evidence", () => {
    const { root } = fixture();
    const log = ".tmp/qa-logs/checkpoint.log";
    mkdirSync(join(root, ".tmp/qa-logs"), { recursive: true });
    writeFileSync(
      join(root, log),
      `wrapper=qa:checkpoint\n\nstatus=passed\nfinishedAt=2026-11-01T00:00:00Z\nlog=${log}\n`,
    );
    const digest = candidateDigest(root);
    recordProof("checkpoint", digest, log, root);
    expect(hasProof("checkpoint", digest, root)).toBe(true);
    writeFileSync(join(root, "new file.ts"), "new");
    expect(hasProof("checkpoint", candidateDigest(root), root)).toBe(false);
    rmSync(join(root, "new file.ts"));
    writeFileSync(
      join(root, "node_modules/oxlint/package.json"),
      '{"version":"changed"}',
    );
    expect(hasProof("checkpoint", candidateDigest(root), root)).toBe(false);
    writeFileSync(join(root, log), "\nstatus=failed\n");
    expect(hasProof("checkpoint", digest, root)).toBe(false);
    expect(() => recordProof("checkpoint", digest, log, root)).toThrow(
      "did not pass",
    );
    writeFileSync(join(root, ".tmp/qa-proof/checkpoint.json"), "{");
    expect(hasProof("checkpoint", digest, root)).toBe(false);
    removeProof("checkpoint", root);
    expect(hasProof("checkpoint", digest, root)).toBe(false);
  });
  it("ignores temporary evidence but binds the semantic index", () => {
    const { root, git } = fixture();
    const before = candidateDigest(root);
    mkdirSync(join(root, ".tmp"));
    writeFileSync(join(root, ".tmp/report"), "ignored");
    expect(candidateDigest(root)).toBe(before);
    writeFileSync(join(root, "source.ts"), "changed");
    const content = candidateDigest(root, false);
    const unstaged = candidateDigest(root);
    git("add", "source.ts");
    expect(candidateDigest(root)).not.toBe(unstaged);
    expect(candidateDigest(root, false)).toBe(content);
  });
  it("rejects implicit commits and narrow closeout arguments", () => {
    for (const args of [
      [],
      ["-m"],
      ["--files", "x"],
      ["-m", ""],
      ["-m", "ok", "--no-commit"],
    ])
      expect(() => parseCommitMessage(args)).toThrow("Usage:");
    expect(parseCommitMessage(["-m", "candidate"])).toBe("candidate");
  });
  it("routes proof for code, assets, dependency changes, and authored skill payloads", () => {
    expect(classifyScope(["README.md"])).toMatchObject({
      coverage: false,
      build: false,
      security: false,
    });
    expect(
      classifyScope(["src/apps/viewer/transport/message-boundary.ts"]),
    ).toMatchObject({ coverage: true, build: true, security: true });
    expect(classifyScope(["package-lock.json"])).toMatchObject({
      build: true,
      security: true,
    });
    expect(
      classifyScope(["docs/authoring/create-effect/SKILL.md"]),
    ).toMatchObject({ build: true });
    expect(readFileSync(join(fixture().root, "source.ts"), "utf8")).toBe(
      "original\n",
    );
  });
});
