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
  writeFile,
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
await mkdir(bin, { recursive: true });
for (const tool of readToolchain().tools) {
  const directory = await mkdtemp(join(root, "download-"));
  try {
    const response = await fetch(tool.url, {
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok)
      throw new Error(`Cannot download ${tool.name}: HTTP ${response.status}.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== tool.sha256)
      throw new Error(`SHA-256 mismatch for ${tool.name}.`);
    const archive = join(directory, "download");
    await writeFile(archive, bytes, { mode: 0o600 });
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
    const target = join(bin, tool.name);
    await copyFile(executable, target);
    await chmod(target, 0o700);
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
