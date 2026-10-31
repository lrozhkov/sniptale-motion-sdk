import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runMotionCli } from "../../src/apps/cli/commands.js";

export async function runRepositoryMotionCommand(
  command: "prove" | "validate",
): Promise<void> {
  const root = new URL("../../", import.meta.url);
  const manifest: unknown = JSON.parse(
    await readFile(new URL("package.json", root), "utf8"),
  );
  if (
    !manifest ||
    typeof manifest !== "object" ||
    !("version" in manifest) ||
    typeof manifest.version !== "string"
  )
    throw new Error("Invalid toolkit version.");
  const controller = new AbortController();
  const interrupt = () => controller.abort(130);
  const terminate = () => controller.abort(143);
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  try {
    const args = process.argv.slice(2);
    process.exitCode = await runMotionCli(
      [
        command,
        ...args,
        ...(command === "prove" && !args.includes("--json") ? ["--json"] : []),
      ],
      {
        cwd: process.cwd(),
        packageRoot: fileURLToPath(new URL("dist/", root)),
        version: manifest.version,
        signal: controller.signal,
        stdout: (text) => {
          process.stdout.write(text);
        },
        stderr: (text) => {
          process.stderr.write(text);
        },
      },
    );
    if (controller.signal.aborted)
      process.exitCode = controller.signal.reason === 130 ? 130 : 143;
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  }
}
