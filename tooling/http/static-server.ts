import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { FileHandle } from "node:fs/promises";
import { constants, realpathSync } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

import { isLoopbackHostHeader } from "./loopback-host.ts";

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

export function startStaticServer(
  root: string,
  port: number,
  host = "127.0.0.1",
): Promise<Server> {
  const absoluteRoot = realpathSync(resolve(root));
  const server = createServer((request, response) => {
    void handleRequest(absoluteRoot, request, response).catch(() => {
      send(response, 500, "Server error");
    });
  });

  return new Promise<Server>((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolveServer(server);
    });
  });
}

async function handleRequest(
  absoluteRoot: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!isLoopbackHostHeader(request.headers.host)) {
    send(response, 403, "Forbidden");
    return;
  }
  const file = await readRequestFile(absoluteRoot, request.url);
  if (!file) {
    send(response, 404, "Not found");
    return;
  }
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type":
      mimeTypes.get(extname(file.path)) || "application/octet-stream",
  });
  response.end(file.bytes);
}

async function readRequestFile(
  absoluteRoot: string,
  requestUrl: string | undefined,
) {
  let handle: FileHandle | undefined;
  try {
    const url = new URL(requestUrl || "/", "http://127.0.0.1");
    const decodedPath = decodeURIComponent(
      url.pathname === "/" ? "/index.html" : url.pathname,
    );
    const candidate = resolve(absoluteRoot, `.${decodedPath}`);
    if (!isWithinRoot(absoluteRoot, candidate)) return null;
    const path = await realpath(candidate);
    if (!isWithinRoot(absoluteRoot, path)) return null;
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

function isWithinRoot(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
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
