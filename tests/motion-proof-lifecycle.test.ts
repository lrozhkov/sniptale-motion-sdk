import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { runMotionCli } from "../src/apps/cli/commands";
import { createStarterDocument } from "../src/apps/cli/starter";

const launch = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<unknown>>(),
);
vi.mock("playwright-core", () => ({ chromium: { launch } }));
const roots: string[] = [];
afterEach(async () => {
  launch.mockReset();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function fixture() {
  const base = resolve(".tmp/tests");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "proof-lifecycle-"));
  roots.push(root);
  const file = join(root, "effect.json");
  await writeFile(
    file,
    JSON.stringify(createStarterDocument("sample", "standalone")),
  );
  for (const name of ["viewer", "sandbox"])
    await mkdir(join(root, "apps", name), { recursive: true });
  let stdout = "";
  let stderr = "";
  const invoke = (command: string, signal?: AbortSignal) =>
    runMotionCli([command, file, "--json"], {
      cwd: root,
      packageRoot: root,
      version: "0.1.0",
      ...(signal ? { signal } : {}),
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      },
    });
  return { root, file, invoke, output: () => ({ stdout, stderr }) };
}

describe("browser proof failure boundaries", () => {
  it("rejects invalid JSON before browser startup and redacts parser excerpts", async () => {
    const { file, invoke, output } = await fixture();
    await writeFile(file, "SECRET_USER_DOCUMENT_MARKER");
    expect(await invoke("prove")).toBe(1);
    expect(launch).not.toHaveBeenCalled();
    expect(output().stdout).not.toContain("SECRET_USER_DOCUMENT_MARKER");
    expect(JSON.parse(output().stdout)).toMatchObject({
      ok: false,
      proof: { schema: "failed", runtime: "not-run" },
      diagnostics: [{ code: "JSON_INVALID" }],
    });
  });
  it("also redacts JSON excerpts in static validation", async () => {
    const { file, invoke, output } = await fixture();
    await writeFile(file, "SECRET_USER_DOCUMENT_MARKER");
    expect(await invoke("validate")).toBe(1);
    expect(output().stdout).not.toContain("SECRET_USER_DOCUMENT_MARKER");
  });
  it("does not echo document values or unknown property names in semantic diagnostics", async () => {
    const { file, invoke, output } = await fixture();
    const document = createStarterDocument("sample", "standalone");
    const source = {
      ...document,
      SECRET_PROPERTY_MARKER: "SECRET_DOCUMENT_VALUE",
      program: {
        ...document.program,
        commands: [{ op: "SECRET_OPERATION_MARKER" }],
      },
    };
    await writeFile(file, JSON.stringify(source));
    expect(await invoke("prove")).toBe(1);
    expect(output().stdout).not.toMatch(/SECRET_/);
    expect(JSON.parse(output().stdout)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        {
          code: "COMMAND_OP",
          path: "$.program.commands[0].op",
          message: expect.any(String),
          severity: "error",
          suggestion: expect.any(String),
        },
      ]),
    });
    expect(launch).not.toHaveBeenCalled();
  });
  it("does not echo asset payloads or identifiers in boundary errors", async () => {
    const { file, invoke, output } = await fixture();
    const document = createStarterDocument("sample", "standalone");
    document.assets = [
      {
        id: "SECRET_ASSET_ID",
        kind: "svg",
        mimeType: "image/svg+xml",
        svgText: "SECRET_ASSET_BODY",
      },
    ];
    await writeFile(file, JSON.stringify(document));
    expect(await invoke("validate")).toBe(1);
    expect(output().stdout).not.toMatch(/SECRET_/);
  });
  it("closes the browser and listeners and removes temporary files after a driver failure", async () => {
    const { root, file, invoke, output } = await fixture();
    const original = await readFile(file);
    const close = vi.fn(async () => {});
    launch.mockResolvedValueOnce({
      version: () => "156.0.8078.4",
      close,
      newContext: async () => {
        throw new Error("SECRET /private/profile");
      },
    });
    expect(await invoke("prove")).toBe(1);
    expect(close).toHaveBeenCalledOnce();
    expect(await readdir(join(root, ".tmp"))).toEqual([]);
    expect(await readFile(file)).toEqual(original);
    expect(output().stdout).not.toMatch(/SECRET|private\/profile/);
    expect(output().stderr).toBe("");
  });
  it("awaits browser shutdown when the command is cancelled during driver setup", async () => {
    const { root, invoke } = await fixture();
    const pendingContext = Promise.withResolvers<never>();
    const newContext = vi.fn(() => pendingContext.promise);
    const close = vi.fn(async () => {
      pendingContext.reject(new Error("closed"));
    });
    launch.mockResolvedValueOnce({
      version: () => "156.0.8078.4",
      close,
      newContext,
    });
    const controller = new AbortController();
    const pending = invoke("prove", controller.signal);
    await vi.waitFor(() => expect(newContext).toHaveBeenCalledOnce());
    controller.abort();
    expect(await pending).toBe(1);
    expect(close).toHaveBeenCalledOnce();
    expect(await readdir(join(root, ".tmp"))).toEqual([]);
  });
});
