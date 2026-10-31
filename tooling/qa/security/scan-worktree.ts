import { spawn } from "node:child_process";
import { chmod, copyFile, mkdir, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";

import {
  createSecurityEnvironment,
  GITLEAKS_CONFIG_PATH,
  GITLEAKS_IGNORE_PATH,
} from "./environment.ts";

const repoRoot = process.cwd();
const evidenceRoot = resolve(repoRoot, ".tmp/security");
const indexSnapshotRoot = resolve(evidenceRoot, `index-${process.pid}`);
const worktreeSnapshotRoot = resolve(evidenceRoot, `worktree-${process.pid}`);
const temporaryIndex = resolve(evidenceRoot, `worktree-${process.pid}.index`);
const indexReport = resolve(evidenceRoot, "gitleaks-index.json");
const worktreeReport = resolve(evidenceRoot, "gitleaks-worktree.json");
const securityEnvironment = createSecurityEnvironment(process.env, {
  npmUserConfig: resolve(evidenceRoot, "npmrc"),
});
const gitEnvironment = {
  ...securityEnvironment,
  GIT_INDEX_FILE: temporaryIndex,
};

await mkdir(evidenceRoot, { recursive: true, mode: 0o700 });
await rm(indexSnapshotRoot, { force: true, recursive: true });
await rm(worktreeSnapshotRoot, { force: true, recursive: true });
await rm(temporaryIndex, { force: true });
await mkdir(indexSnapshotRoot, { recursive: true, mode: 0o700 });
await mkdir(worktreeSnapshotRoot, { recursive: true, mode: 0o700 });

try {
  await assertScannableIndex("Git index", securityEnvironment, {
    rejectHiddenWorktreeEntries: true,
  });
  await run(
    "git",
    ["checkout-index", "--all", `--prefix=${indexSnapshotRoot}${sep}`],
    { env: securityEnvironment },
  );
  await scanSnapshot("Git index", indexSnapshotRoot, indexReport);

  const currentIndex = await run("git", ["rev-parse", "--git-path", "index"], {
    env: securityEnvironment,
  });
  await copyFile(resolve(repoRoot, currentIndex.stdout.trim()), temporaryIndex);
  await chmod(temporaryIndex, 0o600);
  await run("git", ["add", "-A", "--", "."], { env: gitEnvironment });
  await run(
    "git",
    [
      "rm",
      "-r",
      "--cached",
      "--ignore-unmatch",
      "--",
      ".tmp",
      "dist",
      "node_modules",
    ],
    { env: gitEnvironment },
  );
  await assertScannableIndex("worktree candidate", gitEnvironment);
  await run(
    "git",
    ["checkout-index", "--all", `--prefix=${worktreeSnapshotRoot}${sep}`],
    { env: gitEnvironment },
  );
  await scanSnapshot("worktree", worktreeSnapshotRoot, worktreeReport);
  process.stdout.write(
    "Gitleaks accepted the current Git index and worktree candidate.\n",
  );
} finally {
  await rm(indexSnapshotRoot, { force: true, recursive: true });
  await rm(worktreeSnapshotRoot, { force: true, recursive: true });
  await rm(temporaryIndex, { force: true });
}

async function assertScannableIndex(
  label: string,
  environment: NodeJS.ProcessEnv,
  {
    rejectHiddenWorktreeEntries = false,
  }: { rejectHiddenWorktreeEntries?: boolean } = {},
) {
  if (rejectHiddenWorktreeEntries) {
    const flags = await run("git", ["ls-files", "-v", "-z"], {
      env: environment,
    });
    const hidden = flags.stdout
      .split("\0")
      .filter(Boolean)
      .filter((record) => /^[a-zS] /u.test(record))
      .map((record) => record.slice(2));
    if (hidden.length > 0) {
      throw new Error(
        `${label} contains skip-worktree or assume-unchanged entries; clear those flags before qa:security: ${hidden.join(", ")}`,
      );
    }
  }

  const staged = await run("git", ["ls-files", "--stage", "-z"], {
    env: environment,
  });
  const unsupported = staged.stdout
    .split("\0")
    .filter(Boolean)
    .flatMap((record) => {
      const separator = record.indexOf("\t");
      const [mode, , stage] = record.slice(0, separator).split(" ");
      const path = record.slice(separator + 1);
      return ["100644", "100755"].includes(mode ?? "") && stage === "0"
        ? []
        : [`${path} (${mode ?? "invalid"}, stage ${stage ?? "invalid"})`];
    });
  if (unsupported.length > 0) {
    throw new Error(
      `${label} contains symlink, gitlink, sparse-directory, or unmerged entries that cannot be scanned as regular files: ${unsupported.join(", ")}`,
    );
  }
}

async function scanSnapshot(
  label: string,
  snapshotRoot: string,
  report: string,
): Promise<void> {
  const result = await run(
    "gitleaks",
    [
      "dir",
      "--config",
      GITLEAKS_CONFIG_PATH,
      "--gitleaks-ignore-path",
      GITLEAKS_IGNORE_PATH,
      "--redact=100",
      "--ignore-gitleaks-allow",
      "--max-archive-depth=2",
      "--timeout=120",
      "--report-format",
      "json",
      "--report-path",
      report,
      "--no-banner",
      "--no-color",
      "--log-level",
      "error",
      snapshotRoot,
    ],
    { env: securityEnvironment, allowedExitCodes: [0, 1] },
  );
  await chmod(report, 0o600);
  if (result.code !== 0) {
    throw new Error(
      `Gitleaks rejected the current ${label}; inspect ${report.slice(repoRoot.length + 1)}.`,
    );
  }
}

function run(
  command: string,
  args: readonly string[],
  {
    env = process.env,
    allowedExitCodes = [0],
  }: { env?: NodeJS.ProcessEnv; allowedExitCodes?: readonly number[] } = {},
): Promise<{ code: number; stdout: string }> {
  return new Promise<{ code: number; stdout: string }>((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code, signal) => {
      const exitCode = code !== null && Number.isInteger(code) ? code : 1;
      if (allowedExitCodes.includes(exitCode)) {
        resolveRun({
          code: exitCode,
          stdout: Buffer.concat(stdout).toString("utf8"),
        });
        return;
      }
      reject(
        new Error(
          `${command} failed with ${signal ? `signal ${signal}` : `exit code ${exitCode}`}: ${Buffer.concat(stderr).toString("utf8").trim()}`,
        ),
      );
    });
  });
}
