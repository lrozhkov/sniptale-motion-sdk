import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";

export function signalProcessGroup(
  child: ChildProcess,
  signal: NodeJS.Signals,
): void {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH"))
      child.kill(signal);
  }
}

export async function stopWindowsProcessTree(
  child: ChildProcess,
): Promise<void> {
  if (!child.pid) return;
  await new Promise<void>((resolve) => {
    const killer = spawn(
      join(process.env.SystemRoot ?? "C:\\Windows", "System32/taskkill.exe"),
      ["/PID", String(child.pid), "/T", "/F"],
      { stdio: "ignore", windowsHide: true },
    );
    killer.once("error", () => {
      child.kill();
    });
    killer.once("close", (code) => {
      if (code !== 0 && child.exitCode === null) child.kill();
      resolve();
    });
  });
}
