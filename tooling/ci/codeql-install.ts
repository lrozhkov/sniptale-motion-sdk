import { downloadPinnedArchive } from "./download.cjs";
import { readCodeqlToolchain, codeqlRoot } from "./codeql-toolchain.ts";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runOwnedChild } from "../process/child.ts";

export async function installCodeql(): Promise<void> {
  if (process.platform !== "linux" || process.arch !== "x64")
    throw new Error(
      "The full local CI toolchain requires Linux x64. Use WSL on Windows.",
    );
  const value = readCodeqlToolchain();
  const root = codeqlRoot();
  await mkdir(root, { recursive: true });
  // The upstream parser uses CommonJS. Isolate it from this workspace's ESM package scope.
  await writeFile(resolve(root, "package.json"), '{"type":"commonjs"}\n', {
    mode: 0o600,
  });
  const archive = resolve(root, "bundle.tar.gz");
  if (!existsSync(archive)) {
    await downloadPinnedArchive(
      value.url,
      archive,
      value.sha256,
      1024 * 1024 * 1024,
    );
  }

  const digest = createHash("sha256");
  for await (const bytes of createReadStream(
    archive,
  ) as AsyncIterable<unknown>) {
    if (!Buffer.isBuffer(bytes))
      throw new Error("CodeQL archive stream must contain bytes.");
    digest.update(bytes);
  }
  if (digest.digest("hex") !== value.sha256)
    throw new Error(
      "CodeQL bundle SHA-256 mismatch. Remove the invalid local archive before retrying.",
    );
  if (!existsSync(resolve(root, "codeql/codeql"))) {
    const result = await runOwnedChild(
      "tar",
      [
        "--extract",
        "--gzip",
        "--file",
        archive,
        "--directory",
        root,
        "--no-same-owner",
      ],
      { stdio: "inherit" },
    );
    if (result.code !== 0) throw new Error("CodeQL bundle extraction failed.");
  }
  process.stdout.write(
    `CodeQL ${value.version} bundle verified under .tmp/codeql-toolchain.\n`,
  );
}
await installCodeql();
