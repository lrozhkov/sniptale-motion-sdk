import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { runBrowserInstaller } from "../src/apps/cli/browser/installer-process";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function fixture(source: string) {
  const base = resolve(".tmp/tests");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "browser installer "));
  roots.push(root);
  const file = join(root, "cli with spaces.mjs");
  await writeFile(file, source);
  return { file, root };
}

describe("explicit browser installation process", () => {
  it("uses the current Node and fixed Chromium arguments without a shell", async () => {
    const { file, root } = await fixture(
      'import { writeFileSync } from "node:fs"; writeFileSync(new URL("./args.json", import.meta.url), JSON.stringify(process.argv.slice(2)));',
    );
    expect(await runBrowserInstaller(file)).toBe(true);
    expect(JSON.parse(await readFile(join(root, "args.json"), "utf8"))).toEqual(
      ["install", "--no-shell", "chromium"],
    );
  });

  it("reports a failed installer without publishing child output", async () => {
    const { file } = await fixture(
      'console.log("SECRET installer content"); console.error("SECRET backend path"); process.exitCode = 1;',
    );
    expect(await runBrowserInstaller(file)).toBe(false);
  });

  it("does not start an installer for an already cancelled command", async () => {
    const { file, root } = await fixture(
      'import { writeFileSync } from "node:fs"; writeFileSync(new URL("./started", import.meta.url), "started");',
    );
    await expect(
      runBrowserInstaller(file, AbortSignal.abort()),
    ).rejects.toMatchObject({ name: "AbortError" });
    await expect(readFile(join(root, "started"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("cancels an active installer and its child before returning", async () => {
    const { file, root } =
      await fixture(`import { spawn } from "node:child_process";
      import { writeFileSync } from "node:fs";
      const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
      writeFileSync(new URL("./child.pid", import.meta.url), String(child.pid));
      setInterval(() => {}, 1000);`);
    const controller = new AbortController();
    const pending = runBrowserInstaller(file, controller.signal);
    const failed = pending.then(
      () => null,
      (error: unknown) => error,
    );
    let pid = 0;
    try {
      await vi.waitFor(async () => {
        pid = Number(await readFile(join(root, "child.pid"), "utf8"));
        expect(pid).toBeGreaterThan(0);
      });
    } finally {
      controller.abort();
    }
    await expect(failed).resolves.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(() => process.kill(pid, 0)).toThrow("ESRCH"));
  }, 20_000);
});
