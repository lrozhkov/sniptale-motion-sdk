import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";
import { runOwnedChild } from "./child.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const base = resolve(".tmp/tests");
  mkdirSync(base, { recursive: true });
  const root = mkdtempSync(join(base, "owned child "));
  roots.push(root);
  return root;
}

describe("owned command lifecycle", () => {
  it("does not start a command after cancellation", async () => {
    const marker = join(fixture(), "unexpected execution");
    await expect(
      runOwnedChild(
        process.execPath,
        [
          "-e",
          `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'started');`,
        ],
        {
          signal: AbortSignal.abort(new Error("already cancelled")),
        },
      ),
    ).rejects.toThrow("already cancelled");
    expect(existsSync(marker)).toBe(false);
  });
  it("reports spawn failure after the command closes", async () => {
    await expect(
      runOwnedChild(join(fixture(), "missing executable"), []),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("returns the actual command result and forwards both output streams", async () => {
    const output: string[] = [];
    const result = await runOwnedChild(
      process.execPath,
      [
        "-e",
        'process.stdout.write("out");process.stderr.write("err");process.exitCode=7;',
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        stdout: (chunk) => output.push(chunk.toString()),
        stderr: (chunk) => output.push(chunk.toString()),
      },
    );
    expect(result).toEqual({ code: 7, signal: null });
    expect(output.sort()).toEqual(["err", "out"]);
  });
  it("stops a command and its detached descendant when they ignore graceful termination", async () => {
    const root = fixture();
    const heartbeat = join(root, "heartbeat");
    const grandchild = join(root, "grandchild.cjs");
    writeFileSync(
      grandchild,
      `const fs=require('node:fs');process.on('SIGTERM',()=>{});setInterval(()=>fs.appendFileSync(${JSON.stringify(heartbeat)},'.'),25);process.stdout.write('ready');`,
    );
    const controller = new AbortController();
    const ready = Promise.withResolvers<void>();
    const command = runOwnedChild(
      process.execPath,
      [
        "-e",
        `const {spawn}=require('node:child_process');process.on('SIGTERM',()=>{});const child=spawn(process.execPath,[${JSON.stringify(grandchild)}],{detached:process.platform!=='win32',stdio:['ignore','pipe','ignore']});child.stdout.once('data',()=>process.stdout.write('ready'));setInterval(()=>{},1000);`,
      ],
      {
        signal: controller.signal,
        stdio: ["ignore", "pipe", "pipe"],
        stdout: () => ready.resolve(),
      },
    );
    // Attach rejection handling before triggering cancellation.
    const settled = command.catch((error: unknown) => error);
    const watchdog = setTimeout(() => {
      ready.reject(new Error("Child tree did not become ready."));
      controller.abort();
    }, 8000);
    try {
      await ready.promise;
      await delay(75);
      controller.abort(new Error("cancel tree"));
      expect(await settled).toMatchObject({ message: "cancel tree" });
      const stopped = readFileSync(heartbeat, "utf8");
      await delay(100);
      expect(readFileSync(heartbeat, "utf8")).toBe(stopped);
    } finally {
      clearTimeout(watchdog);
      controller.abort();
      await settled;
    }
  }, 15000);
});
