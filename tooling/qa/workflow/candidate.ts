import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
  readlinkSync,
} from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";

export function git(root: string, args: readonly string[]): string {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

export function changedFiles(root = process.cwd()): string[] {
  const fields = git(root, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]).split("\0");
  const files = new Set<string>();
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (!field) continue;
    const status = field.slice(0, 2);
    if (status.includes("U") || status === "AA" || status === "DD")
      throw new Error("Resolve Git conflicts before QA.");
    files.add(field.slice(3));
    if (/[RC]/u.test(status)) {
      const previous = fields[++index];
      if (!previous) throw new Error("Invalid Git rename record.");
      files.add(previous);
    }
  }
  return [...files].sort();
}

export function candidateDigest(
  root = process.cwd(),
  includeIndex = true,
): string {
  const digest = createHash("sha256");
  const append = (value: string | Buffer) => {
    const bytes = Buffer.from(value);
    digest.update(`${bytes.length}:`);
    digest.update(bytes);
  };
  append(git(root, ["rev-parse", "HEAD"]));
  if (includeIndex) append(git(root, ["ls-files", "--stage", "-z"]));
  append(
    JSON.stringify({
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      env: Object.fromEntries(
        [
          "CI",
          "NODE_ENV",
          "NODE_OPTIONS",
          "TZ",
          "LANG",
          "PATH",
          "PLAYWRIGHT_BROWSERS_PATH",
          "MOTION_NPM_BROWSER_ACCEPT",
        ].map((key) => [
          key,
          key === "PATH"
            ? [...new Set(process.env.PATH?.split(delimiter))].join(delimiter)
            : process.env[key],
        ]),
      ),
    }),
  );
  append(process.execPath);
  if (process.env.npm_execpath) {
    append(process.env.npm_execpath);
    append(
      readFileSync(
        resolve(dirname(process.env.npm_execpath), "../package.json"),
      ),
    );
  }
  const files = [
    ...new Set(
      (
        git(root, ["ls-tree", "-r", "--name-only", "-z", "HEAD"]) +
        git(root, [
          "ls-files",
          "--cached",
          "--others",
          "--exclude-standard",
          "-z",
        ])
      )
        .split("\0")
        .filter(Boolean),
    ),
  ].sort();
  for (const file of files) {
    append(file);
    const path = join(root, file);
    let descriptor: number;
    try {
      descriptor = openSync(
        path,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        if (error.code === "ENOENT") {
          append("deleted");
          continue;
        }
        if (error.code === "ELOOP") {
          append("symlink");
          append(readlinkSync(path));
          continue;
        }
      }
      throw error;
    }
    try {
      const stat = fstatSync(descriptor);
      if (!stat.isFile())
        throw new Error(`Unsupported candidate entry: ${file}`);
      append(String(stat.mode));
      append(readFileSync(descriptor));
    } finally {
      closeSync(descriptor);
    }
  }
  for (const name of [
    "tsx",
    "oxlint",
    "oxfmt",
    "vitest",
    "@typescript/native",
  ]) {
    append(readFileSync(join(root, "node_modules", name, "package.json")));
  }
  return digest.digest("hex");
}
