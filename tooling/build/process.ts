import { resolveToolCommand } from "../process/command.ts";
import type { SpawnOptions } from "node:child_process";
import { spawn } from "node:child_process";

export function execa(
  command: string,
  args: readonly string[],
  options: SpawnOptions = {},
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const invocation = resolveToolCommand(command, args);
    const child = spawn(invocation.command, invocation.args, {
      stdio: "inherit",
      ...options,
      shell: false,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} exited with code ${code ?? "signal"}`,
        ),
      );
    });
  });
}
