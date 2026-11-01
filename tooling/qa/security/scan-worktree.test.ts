import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const scanner = resolve("tooling/qa/security/scan-worktree.ts");

describe("Gitleaks worktree candidate", () => {
  it("includes force-staged files hidden by Git ignore rules and a split index", () => {
    const root = mkdtempSync(join(tmpdir(), "sniptale-gitleaks-index-"));
    try {
      mkdirSync(join(root, "tooling/configs/qa"), { recursive: true });
      mkdirSync(join(root, "fake-bin"));
      writeFileSync(
        join(root, ".gitignore"),
        "ignored-candidate.txt\n.tmp/\nfake-bin/\n",
      );
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ type: "commonjs" }),
      );
      writeFileSync(join(root, "tracked.txt"), "tracked\n");
      writeFileSync(
        join(root, "tooling/configs/qa/gitleaks.toml"),
        "[extend]\nuseDefault = true\n",
      );
      execFileSync("git", ["init", "--quiet"], { cwd: root });
      execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: root });
      execFileSync("git", ["add", "."], { cwd: root });
      execFileSync(
        "git",
        [
          "-c",
          "user.name=Sniptale QA",
          "-c",
          "user.email=qa@example.invalid",
          "commit",
          "--quiet",
          "-m",
          "fixture",
        ],
        { cwd: root },
      );
      writeFileSync(
        join(root, "ignored-candidate.txt"),
        "force-staged-ignored-marker\n",
      );
      execFileSync("git", ["add", "--force", "ignored-candidate.txt"], {
        cwd: root,
      });
      execFileSync("git", ["update-index", "--split-index"], { cwd: root });
      writeFileSync(join(root, "ignored-candidate.txt"), "clean-worktree\n");
      const fakeGitleaks =
        process.platform === "win32"
          ? join(root, "dir")
          : join(root, "fake-bin", "gitleaks");
      if (process.platform === "win32")
        copyFileSync(process.execPath, join(root, "fake-bin", "gitleaks.exe"));
      writeFileSync(
        fakeGitleaks,
        `#!/usr/bin/env node
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const reportFlag = process.argv.indexOf("--report-path");
const report = process.argv[reportFlag + 1];
const snapshot = process.argv.at(-1);
const candidate = readFileSync(join(snapshot, "ignored-candidate.txt"), "utf8");
const expected = report.endsWith("gitleaks-index.json")
  ? "force-staged-ignored-marker\\n"
  : "clean-worktree\\n";
if (candidate !== expected) process.exit(2);
writeFileSync(report, "[]\\n");
`,
      );
      chmodSync(fakeGitleaks, 0o700);
      const scannerEnvironment = {
        ...process.env,
        PATH: `${join(root, "fake-bin")}${delimiter}${process.env.PATH ?? ""}`,
      };

      execFileSync(process.execPath, [scanner], {
        cwd: root,
        env: scannerEnvironment,
      });

      expect(
        readFileSync(join(root, ".tmp/security/gitleaks-index.json"), "utf8"),
      ).toBe("[]\n");
      expect(
        readFileSync(
          join(root, ".tmp/security/gitleaks-worktree.json"),
          "utf8",
        ),
      ).toBe("[]\n");

      execFileSync(
        "git",
        ["update-index", "--assume-unchanged", "tracked.txt"],
        {
          cwd: root,
        },
      );
      const hiddenWorktree = spawnSync(process.execPath, [scanner], {
        cwd: root,
        encoding: "utf8",
        env: scannerEnvironment,
      });
      expect(hiddenWorktree.status).toBe(1);
      expect(hiddenWorktree.stderr).toContain(
        "skip-worktree or assume-unchanged entries",
      );
      execFileSync(
        "git",
        ["update-index", "--no-assume-unchanged", "tracked.txt"],
        { cwd: root },
      );

      execFileSync("git", ["update-index", "--skip-worktree", "tracked.txt"], {
        cwd: root,
      });
      const sparseWorktree = spawnSync(process.execPath, [scanner], {
        cwd: root,
        encoding: "utf8",
        env: scannerEnvironment,
      });
      expect(sparseWorktree.status).toBe(1);
      expect(sparseWorktree.stderr).toContain(
        "skip-worktree or assume-unchanged entries",
      );
      execFileSync(
        "git",
        ["update-index", "--no-skip-worktree", "tracked.txt"],
        { cwd: root },
      );

      const linkObject = execFileSync("git", ["hash-object", "-w", "--stdin"], {
        cwd: root,
        input: "force-staged-ignored-marker",
        encoding: "utf8",
      }).trim();
      execFileSync(
        "git",
        [
          "update-index",
          "--add",
          "--cacheinfo",
          `120000,${linkObject},candidate-link`,
        ],
        { cwd: root },
      );
      const symlinkCandidate = spawnSync(process.execPath, [scanner], {
        cwd: root,
        encoding: "utf8",
        env: scannerEnvironment,
      });
      expect(symlinkCandidate.status).toBe(1);
      expect(symlinkCandidate.stderr).toContain(
        "symlink, gitlink, sparse-directory, or unmerged entries",
      );
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  }, 20_000);
});
