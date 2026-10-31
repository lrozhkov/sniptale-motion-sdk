import type { SpawnOptions } from "node:child_process";
import { spawn } from "node:child_process";

export function execa(
  command: string,
  args: readonly string[],
  options: SpawnOptions = {},
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
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
