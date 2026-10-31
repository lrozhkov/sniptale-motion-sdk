import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";

function killGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH"))
      child.kill(signal);
  }
}

async function stopWindowsTree(child: ChildProcess): Promise<void> {
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

export async function runBrowserInstaller(
  file: string,
  signal?: AbortSignal,
): Promise<boolean> {
  signal?.throwIfAborted();
  const child = spawn(
    process.execPath,
    [file, "install", "--no-shell", "chromium"],
    {
      stdio: "ignore",
      windowsHide: true,
      detached: process.platform !== "win32",
    },
  );
  let failed = false;
  let stopping = false;
  let forced: ReturnType<typeof setTimeout> | undefined;
  let windowsStop: Promise<void> | undefined;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    if (process.platform === "win32") windowsStop = stopWindowsTree(child);
    else {
      killGroup(child, "SIGTERM");
      forced = setTimeout(() => killGroup(child, "SIGKILL"), 2000);
    }
  };
  const timeout = setTimeout(stop, 300_000);
  const completed = new Promise<number | null>((resolve) => {
    child.once("error", () => {
      failed = true;
    });
    child.once("close", (code) => resolve(code));
  });
  signal?.addEventListener("abort", stop, { once: true });
  if (signal?.aborted) stop();
  try {
    const code = await completed;
    await windowsStop;
    if (stopping && process.platform !== "win32") killGroup(child, "SIGKILL");
    signal?.throwIfAborted();
    return code === 0 && !failed && !stopping;
  } finally {
    clearTimeout(timeout);
    clearTimeout(forced);
    signal?.removeEventListener("abort", stop);
  }
}
