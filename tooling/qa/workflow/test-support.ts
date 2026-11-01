import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { recordProof, type ProofLane } from "./proof.ts";
import { candidateDigest } from "./candidate.ts";

export function createCandidateFixture() {
  mkdirSync(resolve(".tmp/workflow-tests"), { recursive: true });
  const root = mkdtempSync(resolve(".tmp/workflow-tests/git-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, stdio: "pipe" });
  git("init", "--quiet");
  git("config", "user.name", "QA");
  git("config", "user.email", "qa@example.invalid");
  writeFileSync(join(root, ".gitignore"), ".tmp/\nnode_modules/\n");
  writeFileSync(join(root, "source.ts"), "original\n");
  git("add", ".");
  git("commit", "-qm", "initial");
  for (const name of [
    "tsx",
    "oxlint",
    "oxfmt",
    "vitest",
    "@typescript/native",
  ]) {
    const directory = join(root, "node_modules", name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "package.json"), "{}");
  }
  return { root, git };
}
export function proveFixture(root: string, lane: ProofLane = "ci-proof"): void {
  const log = `.tmp/qa-logs/${lane}.log`;
  mkdirSync(join(root, ".tmp/qa-logs"), { recursive: true });
  writeFileSync(
    join(root, log),
    `wrapper=${lane === "checkpoint" ? "qa:checkpoint" : lane.replace("ci-", "ci:")}\n\nstatus=passed\nfinishedAt=2026-11-01T00:00:00Z\nlog=${log}\n`,
  );
  recordProof(lane, candidateDigest(root), log, root);
}
