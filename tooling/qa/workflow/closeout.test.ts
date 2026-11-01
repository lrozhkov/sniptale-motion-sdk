import { mkdirSync, rmSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { closeCandidate } from "./closeout.ts";
import { createCandidateFixture, proveFixture } from "./test-support.ts";
import type { QaRunSession } from "../runtime/wrapper-runner.ts";

const roots: string[] = [];
function fixture() {
  const value = createCandidateFixture();
  roots.push(value.root);
  mkdirSync(join(value.root, "src"));
  writeFileSync(join(value.root, "src/changed.ts"), "changed");
  writeFileSync(join(value.root, "source.ts"), "changed\n");
  return value;
}
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
const output = { writeStdout: (_text: string) => {} };
describe("commit closeout authority", () => {
  it("never stages or commits after a failed or missing proof", async () => {
    const { root } = fixture();
    const calls: string[] = [];
    const run: QaRunSession["run"] = async (label) => {
      calls.push(label);
      throw new Error("fixture proof failure");
    };
    await expect(
      closeCandidate("candidate", { ...output, run }, root),
    ).rejects.toThrow("fixture proof failure");
    expect(calls).toEqual(["complete repository proof"]);
    await expect(
      closeCandidate("candidate", { ...output, run: async () => {} }, root),
    ).rejects.toThrow("did not prove");
  });
  it("rejects source drift after the proof command", async () => {
    const { root } = fixture();
    const run: QaRunSession["run"] = async () => {
      proveFixture(root);
      writeFileSync(join(root, "source.ts"), "drift\n");
    };
    await expect(
      closeCandidate("candidate", { ...output, run }, root),
    ).rejects.toThrow("changed during closeout");
  });
  it("reuses exact full proof and commits staged renames and deletion", async () => {
    const { root, git } = fixture();
    renameSync(join(root, "source.ts"), join(root, "новое имя.ts"));
    git("add", "--all");
    proveFixture(root, "ci-release");
    const calls: string[] = [];
    const run: QaRunSession["run"] = async (label, command, args) => {
      calls.push(label);
      expect(command).toBe("git");
      if (!args) throw new Error("Closeout command arguments are required.");
      git(...args);
    };
    await closeCandidate("verified candidate", { ...output, run }, root);
    expect(calls).toEqual(["git add", "git commit"]);
    expect(git("status", "--porcelain").toString()).toBe("");
    expect(git("log", "-1", "--format=%s").toString().trim()).toBe(
      "verified candidate",
    );
  });
  it("cancels a commit when a file appears during staging", async () => {
    const { root, git } = fixture();
    proveFixture(root);
    const calls: string[] = [];
    const run: QaRunSession["run"] = async (label, _command, args) => {
      calls.push(label);
      if (!args) throw new Error("Closeout command arguments are required.");
      git(...args);
      writeFileSync(join(root, "late.ts"), "late");
    };
    await expect(
      closeCandidate("candidate", { ...output, run }, root),
    ).rejects.toThrow("Worktree changed during staging");
    expect(calls).toEqual(["git add"]);
  });
});
