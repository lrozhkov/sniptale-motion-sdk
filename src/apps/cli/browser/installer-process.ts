import { spawn } from "node:child_process";
import {
  signalProcessGroup,
  stopWindowsProcessTree,
} from "../../../shared/node/process-tree.js";

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
    if (process.platform === "win32")
      windowsStop = stopWindowsProcessTree(child);
    else {
      signalProcessGroup(child, "SIGTERM");
      forced = setTimeout(() => signalProcessGroup(child, "SIGKILL"), 2000);
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
    if (stopping && process.platform !== "win32")
      signalProcessGroup(child, "SIGKILL");
    signal?.throwIfAborted();
    return code === 0 && !failed && !stopping;
  } finally {
    clearTimeout(timeout);
    clearTimeout(forced);
    signal?.removeEventListener("abort", stop);
  }
}
