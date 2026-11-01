import { downloadPinnedArchive, assertPinnedArchive } from "./download.cjs";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import {
  appendFile,
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  rename,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { runOwnedChild } from "../process/child.ts";
import { readToolchain } from "./toolchain.ts";

if (process.platform !== "linux" || process.arch !== "x64")
  throw new Error(
    "Pinned CI tools require Linux x64. Product QA also runs on Windows without these Linux tools.",
  );
const root = resolve(".tmp/ci");
const bin = join(root, "bin");
const archives = join(root, "archives");
await mkdir(bin, { recursive: true });
await mkdir(archives, { recursive: true });
for (const tool of readToolchain().tools) {
  const directory = await mkdtemp(join(root, "download-"));
  try {
    const archive = join(archives, tool.sha256);
    const target = join(bin, tool.name);
    try {
      await assertPinnedArchive(archive, tool.sha256, 256 * 1024 * 1024);
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "ENOENT"
      )
        throw error;
      let copied = false;
      if (tool.member === null) {
        try {
          await assertPinnedArchive(target, tool.sha256, 256 * 1024 * 1024);
          await copyFile(target, archive, constants.COPYFILE_EXCL);
          copied = true;
        } catch (error) {
          if (
            !error ||
            typeof error !== "object" ||
            !("code" in error) ||
            (error.code !== "ENOENT" && error.code !== "ARCHIVE_DIGEST")
          )
            throw error;
        }
      }
      if (!copied)
        await downloadPinnedArchive(
          tool.url,
          archive,
          tool.sha256,
          256 * 1024 * 1024,
        );
      await assertPinnedArchive(archive, tool.sha256, 256 * 1024 * 1024);
    }
    let executable = archive;
    if (tool.member !== null) {
      const extracted = await runOwnedChild(
        "tar",
        ["-xzf", archive, "-C", directory, "--", tool.member],
        { stdio: "inherit" },
      );
      if (extracted.code !== 0) throw new Error(`Cannot extract ${tool.name}.`);
      executable = join(directory, tool.member);
    }
    if (!(await lstat(executable)).isFile())
      throw new Error(`CI executable ${tool.name} must be a regular file.`);
    const staged = join(directory, "verified-executable");
    await copyFile(executable, staged);
    await chmod(staged, 0o700);
    await rename(staged, target);
    const installed = await readFile(target);
    process.stdout.write(
      `${tool.name}@${tool.version} installed; executable sha256=${createHash("sha256").update(installed).digest("hex")}\n`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
if (process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_PATH)
  await appendFile(process.env.GITHUB_PATH, `${bin}\n`);
