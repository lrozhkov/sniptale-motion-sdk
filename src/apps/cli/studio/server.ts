import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { realpath } from "node:fs/promises";
import { extname, join } from "node:path";
import { readProject } from "../project.js";
import { readBoundedFile, resolveContainedFile } from "../files.js";
import { readStudioCatalog } from "./catalog.js";
import {
  STUDIO_CATALOG_ROUTE,
  STUDIO_SANDBOX_PARAMETER,
  STUDIO_SESSION_HEADER,
  STUDIO_SESSION_PARAMETER,
} from "../../../shared/studio/protocol.js";

export type MotionStudio = {
  project: string;
  url: string;
  viewerOrigin: string;
  sandboxOrigin: string;
  close(): Promise<void>;
};
const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".woff2", "font/woff2"],
]);

export async function startMotionStudio(
  projectDirectory: string,
  packageRoot: string,
): Promise<MotionStudio> {
  const project = await readProject(projectDirectory);
  const [viewerRoot, sandboxRoot] = await Promise.all([
    realpath(join(packageRoot, "apps/viewer")),
    realpath(join(packageRoot, "apps/sandbox")),
  ]);
  const token = randomBytes(32).toString("hex");
  let viewerOrigin = "";
  let sandboxOrigin = "";
  const makeServer = (root: string, viewer: boolean) =>
    createServer((request, response) => {
      void handleRequest(
        request,
        response,
        root,
        viewer ? viewerOrigin : sandboxOrigin,
        viewer ? viewerOrigin : null,
        token,
        project,
      ).catch(() => send(response, 500, "Studio request failed."));
    });
  const viewer = makeServer(viewerRoot, true);
  const sandbox = makeServer(sandboxRoot, false);
  try {
    viewerOrigin = await listen(viewer);
    sandboxOrigin = await listen(sandbox);
  } catch (error) {
    await Promise.all([closeServer(viewer), closeServer(sandbox)]);
    throw error;
  }
  const url = new URL(viewerOrigin);
  url.searchParams.set(STUDIO_SESSION_PARAMETER, token);
  url.searchParams.set(STUDIO_SANDBOX_PARAMETER, sandboxOrigin);
  let closing: Promise<void> | null = null;
  return {
    project,
    url: url.href,
    viewerOrigin,
    sandboxOrigin,
    close() {
      closing ??= Promise.all([closeServer(viewer), closeServer(sandbox)]).then(
        () => undefined,
      );
      return closing;
    },
  };
}

function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    const failed = (error: Error) => reject(error);
    server.once("error", failed);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", failed);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Studio did not receive a loopback port."));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}
function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  root: string,
  origin: string,
  catalogOrigin: string | null,
  token: string,
  project: string,
): Promise<void> {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "origin");
  if (
    request.headers.host !== new URL(origin).host ||
    (request.headers.origin !== undefined && request.headers.origin !== origin)
  ) {
    send(response, 403, "Forbidden.");
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    send(response, 405, "Method not allowed.");
    return;
  }
  const rawPath = (request.url ?? "/").split("?")[0] ?? "/";
  let path: string;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    send(response, 400, "Invalid path.");
    return;
  }
  if (
    !path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.split("/").some((part) => part === "." || part === "..")
  ) {
    send(response, 400, "Invalid path.");
    return;
  }
  if (path === STUDIO_CATALOG_ROUTE) {
    const supplied = request.headers[STUDIO_SESSION_HEADER];
    if (
      !catalogOrigin ||
      typeof supplied !== "string" ||
      !/^[a-f0-9]{64}$/.test(supplied) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
    ) {
      send(response, 403, "Forbidden.");
      return;
    }
    if (request.method === "HEAD") {
      send(response, 200, "", "application/json; charset=utf-8");
      return;
    }
    send(
      response,
      200,
      JSON.stringify(await readStudioCatalog(project)),
      "application/json; charset=utf-8",
    );
    return;
  }
  const name = path === "/" ? "index.html" : path.slice(1);
  if (!MIME_TYPES.has(extname(name))) {
    send(response, 404, "Not found.");
    return;
  }
  try {
    const file = await resolveContainedFile(root, name);
    const bytes = await readBoundedFile(file, 16_000_000);
    response.writeHead(200, {
      "Content-Type":
        MIME_TYPES.get(extname(name)) ?? "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch {
    send(response, 404, "Not found.");
  }
}
function send(
  response: ServerResponse,
  status: number,
  body: string,
  type = "text/plain; charset=utf-8",
): void {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.writeHead(status, { "Content-Type": type });
  response.end(body);
}
