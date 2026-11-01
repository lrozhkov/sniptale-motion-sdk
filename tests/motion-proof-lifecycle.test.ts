import {
  responseArray,
  responseString,
} from "../tooling/test/fixtures/response.js";
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

const scenario = vi.hoisted(() =>
  vi.fn<() => Promise<{ ok: boolean }>>(async () => ({ ok: true })),
);
vi.mock("../src/apps/cli/proof/scenario.js", () => ({
  runProofScenario: scenario,
}));

const launch = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<unknown>>(),
);
vi.mock("playwright-core", () => ({ chromium: { launch } }));
const roots: string[] = [];
afterEach(async () => {
  launch.mockReset();
  scenario.mockClear();
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
    const result: unknown = JSON.parse(output().stdout);
    expect(result).toMatchObject({ ok: false });
    const diagnostics = responseArray(result, "diagnostics");
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "COMMAND_OP",
        path: "$.program.commands[0].op",
        severity: "error",
      }),
    );
    const diagnostic = diagnostics.find(
      (item) => responseString(item, "code") === "COMMAND_OP",
    );
    expect(responseString(diagnostic, "message")).not.toBe("");
    expect(responseString(diagnostic, "suggestion")).not.toBe("");
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
    const close = vi.fn<() => Promise<void>>(async () => {});
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
  it("preserves a driver failure when browser shutdown also fails", async () => {
    const { root, invoke, output } = await fixture();
    const close = vi.fn<() => Promise<void>>(async () => {
      throw new Error("SECRET_CLOSE_FAILURE");
    });
    launch.mockResolvedValueOnce({
      version: () => "156.0.8078.4",
      close,
      newContext: async () => {
        throw new Error("SECRET_DRIVER_FAILURE");
      },
    });
    expect(await invoke("prove")).toBe(1);
    expect(close).toHaveBeenCalledOnce();
    expect(JSON.parse(output().stdout)).toMatchObject({
      diagnostics: [{ code: "PROOF_RUNTIME" }],
    });
    expect(output().stdout).not.toContain("SECRET_");
    expect(await readdir(join(root, ".tmp"))).toEqual([]);
  });

  it("reports cleanup failure after a successful proof instead of returning success", async () => {
    const { root, invoke, output } = await fixture();
    const close = vi.fn<() => Promise<void>>(async () => {
      throw new Error("SECRET_CLOSE_FAILURE");
    });
    launch.mockResolvedValueOnce({
      version: () => "156.0.8078.4",
      close,
      newContext: async () => ({
        route: async () => {},
        newPage: async () => ({
          setDefaultTimeout() {},
          on() {},
          goto: async () => {},
          waitForFunction: async () => {},
        }),
      }),
    });
    expect(await invoke("prove")).toBe(1);
    expect(scenario).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(JSON.parse(output().stdout)).toMatchObject({
      diagnostics: [{ code: "PROOF_CLEANUP" }],
    });
    expect(output().stdout).not.toContain("SECRET_");
    expect(await readdir(join(root, ".tmp"))).toEqual([]);
  });

  it("awaits browser shutdown when the command is cancelled during driver setup", async () => {
    const { root, invoke } = await fixture();
    const pendingContext = Promise.withResolvers<never>();
    const newContext = vi.fn<() => Promise<never>>(
      () => pendingContext.promise,
    );
    const close = vi.fn<() => Promise<void>>(async () => {
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
