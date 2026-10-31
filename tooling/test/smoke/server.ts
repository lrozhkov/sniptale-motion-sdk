import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileHandle } from "node:fs/promises";
import { constants, realpathSync } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

import { isLoopbackHostHeader } from "../../http/loopback-host.ts";

export async function startServer(
  rootDir: string,
  serverPort: number,
  options: { packRoot?: string } = {},
) {
  const root = realpathSync(resolve(rootDir));
  const packRoot = options.packRoot
    ? realpathSync(resolve(options.packRoot, "packs"))
    : null;
  const server = createServer((request, response) => {
    void handleRequest({ packRoot, request, response, root }).catch(() => {
      send(response, 500, "Server error");
    });
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(serverPort, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
  return server;
}

async function handleRequest({
  packRoot,
  request,
  response,
  root,
}: {
  packRoot: string | null;
  request: IncomingMessage;
  response: ServerResponse;
  root: string;
}): Promise<void> {
  if (!isLoopbackHostHeader(request.headers.host)) {
    send(response, 403, "Forbidden");
    return;
  }
  let pathname;
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    pathname = decodeURIComponent(url.pathname);
  } catch {
    send(response, 404, "Not found");
    return;
  }
  const packRequest = pathname === "/packs" || pathname.startsWith("/packs/");
  const selectedRoot = packRequest ? packRoot : root;
  if (!selectedRoot) {
    send(response, 404, "Not found");
    return;
  }
  const relativePath = packRequest
    ? pathname === "/packs"
      ? ""
      : pathname.slice("/packs/".length)
    : pathname === "/"
      ? "index.html"
      : pathname.slice(1);
  const file = await readContainedFile(selectedRoot, relativePath);
  if (!file) {
    send(response, 404, "Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": contentType(file.path) });
  response.end(file.bytes);
}

async function readContainedFile(root: string, relativePath: string) {
  let handle: FileHandle | undefined;
  try {
    const candidate = resolve(root, relativePath);
    if (!isBelow(root, candidate)) return null;
    const path = await realpath(candidate);
    if (!isBelow(root, path)) return null;
    handle = await open(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const stats = await handle.stat();
    if (!stats.isFile()) return null;
    return { bytes: await handle.readFile(), path };
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function isBelow(root: string, path: string): boolean {
  const pathFromRoot = relative(root, path);
  return (
    pathFromRoot === "" ||
    (!isAbsolute(pathFromRoot) &&
      pathFromRoot !== ".." &&
      !pathFromRoot.startsWith(`..${sep}`))
  );
}

function send(response: ServerResponse, status: number, body: string): void {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}

function contentType(filePath: string): string {
  const ext = extname(filePath);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}
