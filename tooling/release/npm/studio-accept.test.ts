import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createFixtureDirectory } from "../../test/fixtures/storage.ts";
import { acceptInstalledStudio } from "./studio-accept.ts";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fixture(
  options: {
    invalidCatalog?: boolean;
    invalidSession?: boolean;
    shutdownError?: boolean;
  } = {},
) {
  const root = await createFixtureDirectory("studio-process-acceptance");
  directories.push(root);
  const cli = join(root, "studio.mjs");
  // A real Node child exercises pipe completion, HTTP ownership and stop behavior.
  await writeFile(
    cli,
    `
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
const options = ${JSON.stringify(options)};
const servers = [];
async function listen(viewer) {
  const server = createServer((request, response) => {
    if (request.url === "/sniptale-motion.json") { response.writeHead(404); response.end(); return; }
    if (request.url === "/__sniptale/local-effects") {
      response.writeHead(options.invalidCatalog ? 500 : 200, { "content-type": "application/json" });
      response.end(JSON.stringify({ errors: [], effects: [1, 2, 3] })); return;
    }
    response.end(viewer ? "viewer" : "sandbox");
  });
  servers.push(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return "http://127.0.0.1:" + server.address().port;
}
const viewerOrigin = await listen(true);
const sandboxOrigin = await listen(false);
process.on("SIGINT", async () => {
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  writeFileSync("stopped.txt", "closed");
  if (options.shutdownError) process.stderr.write("secondary shutdown failure\\n");
  process.exit(130);
});
process.stdout.write(JSON.stringify({ ok: true, command: "studio", project: process.cwd(),
  url: viewerOrigin + (options.invalidSession ? "/" : "/?studioSession=token"), viewerOrigin, sandboxOrigin }) + "\\n");
`,
  );
  return { cli, project: root, evidence: root, browserCheck: false };
}

describe.skipIf(process.platform === "win32")(
  "installed Studio process lifecycle",
  () => {
    it("waits for shutdown and verifies that both HTTP origins stop", async () => {
      const options = await fixture();
      const result = await acceptInstalledStudio(options);
      expect(result).toEqual({ code: 130, signal: null });
      expect(await readFile(join(options.project, "stopped.txt"), "utf8")).toBe(
        "closed",
      );
      expect(
        await readFile(join(options.evidence, "studio.stderr"), "utf8"),
      ).toBe("");
    });

    it("preserves the HTTP failure when shutdown also fails", async () => {
      const options = await fixture({
        invalidCatalog: true,
        shutdownError: true,
      });
      await expect(acceptInstalledStudio(options)).rejects.toMatchObject({
        actual: 500,
        expected: 200,
      });
      expect(await readFile(join(options.project, "stopped.txt"), "utf8")).toBe(
        "closed",
      );
      expect(
        await readFile(join(options.evidence, "studio.stderr"), "utf8"),
      ).toContain("secondary shutdown failure");
    });

    it("stops the child when readiness cannot be accepted", async () => {
      const options = await fixture({ invalidSession: true });
      await expect(acceptInstalledStudio(options)).rejects.toThrow(
        "Studio readiness must include a session token.",
      );
      expect(await readFile(join(options.project, "stopped.txt"), "utf8")).toBe(
        "closed",
      );
    });
  },
);
