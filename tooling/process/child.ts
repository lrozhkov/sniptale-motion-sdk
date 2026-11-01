import { execFile, spawn, type SpawnOptions } from "node:child_process";
import { promisify } from "node:util";
import {
  signalProcessGroup,
  stopWindowsProcessTree,
} from "../../src/shared/node/process-tree.ts";

const execute = promisify(execFile);
type ChildOptions = Omit<SpawnOptions, "signal" | "detached" | "shell"> & {
  signal?: AbortSignal;
  stdout?: (chunk: Buffer) => void;
  stderr?: (chunk: Buffer) => void;
};

/** Snapshot descendants before signalling their parents, including separate process groups. */
async function descendants(root: number): Promise<Set<number>> {
  const { stdout } = await execute("ps", ["-eo", "pid=,ppid="], {
    encoding: "utf8",
    timeout: 2000,
    maxBuffer: 1024 * 1024,
  });
  const relations = stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [pid, parent] = line.trim().split(/\s+/u).map(Number);
      if (
        pid === undefined ||
        parent === undefined ||
        !Number.isSafeInteger(pid) ||
        !Number.isSafeInteger(parent) ||
        pid <= 0 ||
        parent < 0
      )
        throw new Error("Invalid native process tree snapshot.");
      return { pid, parent };
    });
  const owned = new Set([root]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const relation of relations)
      if (owned.has(relation.parent) && !owned.has(relation.pid)) {
        owned.add(relation.pid);
        changed = true;
      }
  }
  return owned;
}

function signalKnown(pids: ReadonlySet<number>, signal: NodeJS.Signals): void {
  for (const pid of [...pids].reverse()) {
    try {
      process.kill(pid, signal);
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ESRCH")
      )
        throw error;
    }
  }
}

export async function runOwnedChild(
  command: string,
  args: readonly string[],
  options: ChildOptions = {},
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  const { signal, stdout, stderr, ...spawnOptions } = options;
  signal?.throwIfAborted();
  const child = spawn(command, args, {
    ...spawnOptions,
    shell: false,
    detached: process.platform !== "win32",
    windowsHide: true,
  });
  let failure: Error | undefined;
  let cleanupFailure: unknown;
  let stopping: Promise<void> | undefined;
  let forced: ReturnType<typeof setTimeout> | undefined;
  let owned = new Set<number>();
  child.stdout?.on("data", (chunk: Buffer) => stdout?.(chunk));
  child.stderr?.on("data", (chunk: Buffer) => stderr?.(chunk));
  const completed = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => {
    child.once("error", (error: Error) => {
      failure = error;
    });
    child.once("close", (code, exitSignal) =>
      resolve({ code, signal: exitSignal }),
    );
  });
  const force = () => {
    try {
      signalKnown(owned, "SIGKILL");
    } catch (error) {
      cleanupFailure = error;
    } finally {
      signalProcessGroup(child, "SIGKILL");
    }
  };
  const stop = () => {
    stopping ??= (async () => {
      if (!child.pid) return;
      if (process.platform === "win32") {
        await stopWindowsProcessTree(child);
        return;
      }
      owned = await descendants(child.pid);
      signalKnown(owned, "SIGTERM");
      signalProcessGroup(child, "SIGTERM");
      forced = setTimeout(force, 2000);
    })().catch((error: unknown) => {
      cleanupFailure = error;
      signalProcessGroup(child, "SIGKILL");
    });
  };
  signal?.addEventListener("abort", stop, { once: true });
  if (signal?.aborted) stop();
  try {
    const result = await completed;
    await stopping;
    if (stopping && process.platform !== "win32") force();
    if (cleanupFailure !== undefined) throw cleanupFailure;
    signal?.throwIfAborted();
    if (failure) throw failure;
    return result;
  } finally {
    clearTimeout(forced);
    signal?.removeEventListener("abort", stop);
  }
}
