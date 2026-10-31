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
const controller = new AbortController();
const interrupt = () => controller.abort(130);
const terminate = () => controller.abort(143);
process.once("SIGINT", interrupt);
process.once("SIGTERM", terminate);
try {
  process.exitCode = await runMotionCli(process.argv.slice(2), {
    signal: controller.signal,
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

  if (controller.signal.aborted)
    process.exitCode = controller.signal.reason === 130 ? 130 : 143;
} finally {
  process.off("SIGINT", interrupt);
  process.off("SIGTERM", terminate);
}
