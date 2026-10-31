import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { request } from "node:http";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { startStaticServer } from "../tooling/http/static-server.ts";
import { startServer as startSmokeServer } from "../tooling/test/smoke/server.ts";

const cleanup: string[] = [];

afterEach(() => {
  for (const directory of cleanup.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("static server path boundary", () => {
  it("binds to loopback by default", async () => {
    const fixture = createFixture();
    const server = await startStaticServer(fixture.root, 0);
    try {
      const address = server.address();
      expect(address).not.toBeNull();
      expect(typeof address === "string" ? address : address?.address).toBe(
        "127.0.0.1",
      );
    } finally {
      await closeServer(server);
    }
  });

  it("binds the smoke server to loopback", async () => {
    const fixture = createFixture();
    const server = await startSmokeServer(fixture.root, 0);
    try {
      const address = server.address();
      expect(address).not.toBeNull();
      expect(typeof address === "string" ? address : address?.address).toBe(
        "127.0.0.1",
      );
    } finally {
      await closeServer(server);
    }
  });

  it("serves files inside the configured root", async () => {
    const fixture = createFixture();
    const server = await startStaticServer(fixture.root, 0, "127.0.0.1");
    try {
      const response = await fetch(serverUrl(server, "/index.html"));
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("inside");
    } finally {
      await closeServer(server);
    }
  });

  it("rejects encoded traversal into a sibling with the same path prefix", async () => {
    const fixture = createFixture();
    const server = await startStaticServer(fixture.root, 0, "127.0.0.1");
    try {
      const response = await fetch(
        serverUrl(
          server,
          `/%2e%2e%2f${encodeURIComponent(fixture.siblingName)}%2fsecret.txt`,
        ),
      );
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not found");
    } finally {
      await closeServer(server);
    }
  });

  it("rejects symlinks that resolve outside the configured root", async () => {
    const fixture = createFixture();
    symlinkSync(
      join(fixture.sibling, "secret.txt"),
      join(fixture.root, "link.txt"),
    );
    const server = await startStaticServer(fixture.root, 0, "127.0.0.1");
    try {
      const response = await fetch(serverUrl(server, "/link.txt"));
      expect(response.status).toBe(404);
    } finally {
      await closeServer(server);
    }
  });

  it.each([
    ["static", startStaticServer],
    ["smoke", startSmokeServer],
  ])("rejects non-loopback Host headers in the %s server", async (_, start) => {
    const fixture = createFixture();
    const server = await start(fixture.root, 0);
    try {
      const response = await rawRequest(server, "/index.html", "example.test");
      expect(response.status).toBe(403);
      expect(response.body).toBe("Forbidden");
    } finally {
      await closeServer(server);
    }
  });

  it("mounts temporary smoke content only below /packs", async () => {
    const fixture = createFixture();
    writeFileSync(
      join(fixture.packRoot, "index.html"),
      "stale temporary index",
    );
    mkdirSync(join(fixture.packRoot, "packs/demo"), { recursive: true });
    writeFileSync(
      join(fixture.packRoot, "packs/demo/manifest.json"),
      '{"packId":"temporary"}',
    );
    const server = await startSmokeServer(fixture.root, 0, {
      packRoot: fixture.packRoot,
    });
    try {
      const index = await fetch(serverUrl(server, "/index.html"));
      const pack = await fetch(serverUrl(server, "/packs/demo/manifest.json"));
      const escapedPack = await rawRequest(
        server,
        "/packs/..%2findex.html",
        "127.0.0.1",
      );
      expect(await index.text()).toBe("inside");
      expect(await pack.json()).toEqual({ packId: "temporary" });
      expect(escapedPack.status).toBe(404);
    } finally {
      await closeServer(server);
    }
  });

  it("rejects smoke-server symlink escapes", async () => {
    const fixture = createFixture();
    symlinkSync(
      join(fixture.sibling, "secret.txt"),
      join(fixture.root, "link.txt"),
    );
    const server = await startSmokeServer(fixture.root, 0);
    try {
      expect((await fetch(serverUrl(server, "/link.txt"))).status).toBe(404);
    } finally {
      await closeServer(server);
    }
  });

  it.each([
    ["static", startStaticServer],
    ["smoke", startSmokeServer],
  ])(
    "handles malformed paths and directories in the %s server",
    async (_, start) => {
      const fixture = createFixture();
      mkdirSync(join(fixture.root, "directory"));
      const server = await start(fixture.root, 0);
      try {
        expect(
          (await rawRequest(server, "/%E0%A4%A", "127.0.0.1")).status,
        ).toBe(404);
        expect((await fetch(serverUrl(server, "/directory"))).status).toBe(404);
      } finally {
        await closeServer(server);
      }
    },
  );
});

function createFixture() {
  const parent = mkdtempSync(join(tmpdir(), "sniptale-static-server-"));
  cleanup.push(parent);
  const root = join(parent, "public");
  const siblingName = "public-secret";
  const sibling = join(parent, siblingName);
  const packRoot = join(parent, "temporary-public");
  mkdirSync(root);
  mkdirSync(sibling);
  mkdirSync(packRoot);
  writeFileSync(join(root, "index.html"), "inside");
  writeFileSync(join(sibling, "secret.txt"), "outside");
  return { packRoot, root, sibling, siblingName };
}

function serverUrl(server, pathname: string): string {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP server address.");
  }
  return `http://127.0.0.1:${address.port}${pathname}`;
}

function closeServer(server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function rawRequest(
  server,
  path: string,
  hostHeader: string,
): Promise<{ body: string; status: number | undefined }> {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP server address.");
  }
  return new Promise((resolve, reject) => {
    const outgoing = request(
      {
        headers: { Host: hostHeader },
        host: "127.0.0.1",
        path,
        port: address.port,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () =>
          resolve({
            body: Buffer.concat(chunks).toString("utf8"),
            status: response.statusCode,
          }),
        );
      },
    );
    outgoing.on("error", reject);
    outgoing.end();
  });
}
