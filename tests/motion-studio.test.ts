import { createStarterDocument } from "../src/apps/cli/starter";
import { readBoundedFile } from "../src/apps/cli/files";
import { parseLocalEffectCatalog } from "../src/apps/viewer/effect-file/local-catalog";
import { parseEffectV1Source } from "../src/sdk/effect-v1/index";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { request, Server } from "node:http";
import {
  startMotionStudio,
  type MotionStudio,
} from "../src/apps/cli/studio/server";
import { initProject, newEffect } from "../src/apps/cli/project";
import { runMotionCli } from "../src/apps/cli/commands";
import { resolveStudioSandboxOrigin } from "../src/apps/viewer/transport/controller";
import {
  STUDIO_CATALOG_ROUTE,
  STUDIO_SESSION_HEADER,
  STUDIO_SESSION_PARAMETER,
} from "../src/shared/studio/protocol";

const roots: string[] = [];
const studios: MotionStudio[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(studios.splice(0).map((studio) => studio.close()));
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function fixture() {
  const base = join(process.cwd(), ".tmp/tests");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "studio-"));
  roots.push(root);
  const project = join(root, "проект с пробелами");
  const packageRoot = join(root, "package");
  for (const name of ["viewer", "sandbox"]) {
    const dir = join(packageRoot, "apps", name);
    await mkdir(join(dir, "assets"), { recursive: true });
    await writeFile(
      join(dir, name === "viewer" ? "index.html" : "sandbox.html"),
      `<html>${name}</html>`,
    );
    await writeFile(join(dir, "assets/app.js"), "export const ready = true;");
  }
  await initProject(root, project, "0.1.0");
  await newEffect(project, "first", "standalone");
  return { root, project, packageRoot };
}
async function start() {
  const fixtureValue = await fixture();
  const studio = await startMotionStudio(
    fixtureValue.project,
    fixtureValue.packageRoot,
  );
  studios.push(studio);
  const token =
    new URL(studio.url).searchParams.get(STUDIO_SESSION_PARAMETER) ?? "";
  return { ...fixtureValue, studio, token };
}
function raw(
  origin: string,
  path: string,
  headers: Record<string, string> = {},
  method = "GET",
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = request(`${origin}/`, { path, method, headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (data: Buffer) => chunks.push(data));
      response.on("end", () =>
        resolve({
          status: response.statusCode ?? 0,
          text: Buffer.concat(chunks).toString("utf8"),
        }),
      );
    });
    req.on("error", reject);
    req.end();
  });
}

describe("installed Motion Studio server", () => {
  it("binds actual separate loopback origins and serves only packaged applications and an authenticated catalog", async () => {
    const { studio, token } = await start();
    expect(studio.viewerOrigin).not.toBe(studio.sandboxOrigin);
    expect(new URL(studio.url).searchParams.get("sandboxOrigin")).toBe(
      studio.sandboxOrigin,
    );
    expect((await fetch(studio.viewerOrigin)).status).toBe(200);
    expect(
      await (await fetch(`${studio.sandboxOrigin}/sandbox.html`)).text(),
    ).toContain("sandbox");
    const module = await fetch(`${studio.sandboxOrigin}/assets/app.js`, {
      headers: { Origin: studio.sandboxOrigin },
    });
    expect(module.status).toBe(200);
    expect(module.headers.get("x-content-type-options")).toBe("nosniff");
    const catalog = await fetch(
      `${studio.viewerOrigin}${STUDIO_CATALOG_ROUTE}`,
      {
        headers: {
          [STUDIO_SESSION_HEADER]: token,
          Origin: studio.viewerOrigin,
        },
      },
    );
    expect(catalog.status).toBe(200);
    const value: unknown = await catalog.json();
    expect(value).toMatchObject({
      errors: [],
      effects: [
        {
          default: true,
          sourceName: "first.sniptale-effect.json",
          source: expect.stringContaining('"id": "first"'),
        },
      ],
    });
    expect(catalog.headers.get("cache-control")).toBe("no-store");
    expect(catalog.headers.get("referrer-policy")).toBe("origin");
    expect(catalog.headers.has("access-control-allow-origin")).toBe(false);
    const etag = catalog.headers.get("etag");
    expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    const unchanged = await fetch(
      `${studio.viewerOrigin}${STUDIO_CATALOG_ROUTE}`,
      {
        headers: {
          [STUDIO_SESSION_HEADER]: token,
          "If-None-Match": etag ?? "",
        },
      },
    );
    expect(unchanged.status).toBe(304);
    expect(await unchanged.text()).toBe("");
    const forbidden = await fetch(
      `${studio.viewerOrigin}${STUDIO_CATALOG_ROUTE}`,
      { headers: { "If-None-Match": etag ?? "" } },
    );
    expect(forbidden.status).toBe(403);
    await studio.close();
    await studio.close();
    await expect(fetch(studio.viewerOrigin)).rejects.toThrow();
    await expect(fetch(studio.sandboxOrigin)).rejects.toThrow();
  });

  it("rejects unauthenticated, foreign-origin, sandbox and DNS-rebinding API requests", async () => {
    const { studio, token } = await start();
    for (const headers of [
      {},
      { [STUDIO_SESSION_HEADER]: "0".repeat(64) },
      { [STUDIO_SESSION_HEADER]: "é".repeat(64) },
      { [STUDIO_SESSION_HEADER]: token, Origin: "https://evil.example" },
      { [STUDIO_SESSION_HEADER]: token, Host: "evil.example" },
    ]) {
      expect(
        (await raw(studio.viewerOrigin, STUDIO_CATALOG_ROUTE, headers)).status,
      ).toBe(403);
    }
    expect(
      (
        await raw(studio.sandboxOrigin, STUDIO_CATALOG_ROUTE, {
          [STUDIO_SESSION_HEADER]: token,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await raw(
          studio.viewerOrigin,
          STUDIO_CATALOG_ROUTE,
          { [STUDIO_SESSION_HEADER]: token },
          "POST",
        )
      ).status,
    ).toBe(405);
  });

  it("rejects traversal and symlink escapes without exposing the project or package metadata", async () => {
    const { studio, packageRoot } = await start();
    await writeFile(join(packageRoot, "secret.json"), '{"secret":true}');
    await symlink(
      join(packageRoot, "secret.json"),
      join(packageRoot, "apps/viewer/escape.json"),
    );
    for (const path of [
      "/escape.json",
      "/sniptale-motion.json",
      "/effects/first/effect.sniptale-effect.json",
      "/exports/result.json",
      "/package.json",
    ])
      expect((await raw(studio.viewerOrigin, path)).status).toBe(404);
    for (const path of [
      "/../secret.json",
      "/%2e%2e/secret.json",
      "/%2e%2e%2fsecret.json",
      "/%5csecret.json",
      "/%00.json",
      "/%ZZ",
    ])
      expect((await raw(studio.viewerOrigin, path)).status).toBe(400);
  });

  it("reports invalid effects and rejects project source symlinks outside an effect", async () => {
    const { studio, token, project, root } = await start();
    await newEffect(project, "broken", "standalone");
    await writeFile(
      join(project, "effects/broken/effect.sniptale-effect.json"),
      "{",
    );
    await newEffect(project, "escape", "standalone");
    const external = join(root, "external.json");
    await writeFile(external, "{}");
    const escaping = join(
      project,
      "effects/escape/effect.sniptale-effect.json",
    );
    await rm(escaping);
    await symlink(external, escaping);
    await newEffect(project, "mismatch", "standalone");
    const mismatch = createStarterDocument("other", "standalone");
    await writeFile(
      join(project, "effects/mismatch/effect.sniptale-effect.json"),
      JSON.stringify(mismatch),
    );
    const response = await fetch(
      `${studio.viewerOrigin}${STUDIO_CATALOG_ROUTE}`,
      { headers: { [STUDIO_SESSION_HEADER]: token } },
    );
    const value: unknown = await response.json();
    expect(value).toMatchObject({
      effects: [{ sourceName: "first.sniptale-effect.json" }],
      errors: [
        expect.stringContaining("broken"),
        expect.stringContaining("escape"),
        expect.stringContaining("mismatch"),
      ],
    });
  });

  it("materializes relative assets without modifying the source or serving raw project files", async () => {
    const { studio, project, token } = await start();
    await newEffect(project, "asset", "standalone");
    const document = createStarterDocument("asset", "standalone");
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="red"/></svg>';
    document.assets = [
      { id: "mark", kind: "svg", mimeType: "image/svg+xml", path: "mark.svg" },
    ];
    document.program.commands.push({
      op: "image",
      assetId: "mark",
      x: 0,
      y: 0,
      width: 20,
      height: 10,
    });
    const source = JSON.stringify(document);
    const file = join(project, "effects/asset/effect.sniptale-effect.json");
    await writeFile(file, source);
    await writeFile(join(project, "effects/asset/mark.svg"), svg);
    const response = await fetch(
      `${studio.viewerOrigin}${STUDIO_CATALOG_ROUTE}`,
      { headers: { [STUDIO_SESSION_HEADER]: token } },
    );
    const catalog = parseLocalEffectCatalog(await response.json());
    expect(catalog.errors).toEqual([]);
    const entry = catalog.effects.find(
      (effect) => effect.sourceName === "asset.sniptale-effect.json",
    );
    const parsed = parseEffectV1Source(entry?.source ?? "");
    expect(parsed.ok).toBe(true);
    expect(parsed.document?.assets[0]).toMatchObject({
      svgText: svg,
      byteLength: Buffer.byteLength(svg),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(await readFile(file, "utf8")).toBe(source);
    expect(
      await readFile(join(project, "effects/asset/mark.svg"), "utf8"),
    ).toBe(svg);
    expect(
      (await fetch(`${studio.viewerOrigin}/effects/asset/mark.svg`)).status,
    ).toBe(404);
  });

  it("rejects oversized files and non-regular files before reading", async () => {
    const { root } = await fixture();
    const file = join(root, "bounded.txt");
    await writeFile(file, "12345");
    await expect(readBoundedFile(file, 4)).rejects.toThrow("size limit");
    await expect(readBoundedFile(root, 10)).rejects.toThrow();
    expect((await readBoundedFile(file, 5)).toString()).toBe("12345");
  });

  it("releases the first listener when starting the second listener fails", async () => {
    const { project, packageRoot } = await fixture();
    const original = Server.prototype.listen;
    let calls = 0;
    let first: Server | undefined;
    vi.spyOn(Server.prototype, "listen").mockImplementation(function (
      this: Server,
      ...args: unknown[]
    ): Server {
      if (++calls === 2) {
        queueMicrotask(() =>
          this.emit("error", new Error("second listener failed")),
        );
        return this;
      }
      first = this;
      return Reflect.apply(original, this, args) as Server;
    });
    await expect(startMotionStudio(project, packageRoot)).rejects.toThrow(
      "second listener failed",
    );
    expect(first?.listening).toBe(false);
    expect(first?.address()).toBeNull();
  });

  it("emits one machine result and closes both listeners on cancellation", async () => {
    const { project, packageRoot } = await fixture();
    const controller = new AbortController();
    const output: string[] = [];
    const errors: string[] = [];
    const running = runMotionCli(["studio", "--no-open", "--json"], {
      cwd: project,
      packageRoot,
      version: "0.1.0",
      signal: controller.signal,
      stdout: (text) => output.push(text),
      stderr: (text) => errors.push(text),
    });
    await vi.waitFor(() => expect(output).toHaveLength(1));
    const result: unknown = JSON.parse(output[0] ?? "null");
    expect(result).toMatchObject({ ok: true, command: "studio" });
    controller.abort();
    expect(await running).toBe(0);
    expect(errors).toEqual([]);
    expect(output).toHaveLength(1);
    if (
      result &&
      typeof result === "object" &&
      "viewerOrigin" in result &&
      typeof result.viewerOrigin === "string"
    )
      await expect(fetch(result.viewerOrigin)).rejects.toThrow();
  });
});

describe("Studio sandbox origin boundary", () => {
  it("requires a separate explicit IPv4 loopback HTTP origin", () => {
    expect(
      resolveStudioSandboxOrigin(
        "http://127.0.0.1:12345",
        "http://127.0.0.1:54321",
      ),
    ).toBe("http://127.0.0.1:12345");
    for (const value of [
      "https://example.com",
      "http://localhost:12345",
      "http://user@127.0.0.1:12345",
      "http://127.0.0.1:12345/path",
      "http://127.0.0.1:12345?x=1",
      "http://127.0.0.1:54321",
    ])
      expect(() =>
        resolveStudioSandboxOrigin(value, "http://127.0.0.1:54321"),
      ).toThrow();
  });
});
