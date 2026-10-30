#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runMotionCli } from "./commands.js";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const manifest: unknown = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
if (
  manifest === null ||
  typeof manifest !== "object" ||
  !("version" in manifest) ||
  typeof manifest.version !== "string"
) {
  throw new Error("Invalid installed Sniptale Motion manifest.");
}
process.exitCode = await runMotionCli(process.argv.slice(2), {
  cwd: process.cwd(),
  packageRoot,
  version: manifest.version,
  stdout: (text) => {
    process.stdout.write(text);
  },
  stderr: (text) => {
    process.stderr.write(text);
  },
});
