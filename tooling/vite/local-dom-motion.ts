import { readdir, readFile, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import type { Plugin } from "vite";
import { parseDomMotionDocument } from "../../src/sdk/dom-motion/validation.js";

const ROOT = resolve(import.meta.dirname, "../../.tmp/dom-motion");
export function createLocalDomMotionPlugin(root = ROOT): Plugin {
  return {
    name: "sniptale-local-dom-motion",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (
          new URL(request.url ?? "/", "http://127.0.0.1").pathname !==
          "/__sniptale/dom-motion"
        ) {
          next();
          return;
        }
        void readLocalDomMotionDocuments(root)
          .then((documents) => {
            response.statusCode = 200;
            response.setHeader("Cache-Control", "no-store");
            response.setHeader(
              "Content-Type",
              "application/json; charset=utf-8",
            );
            response.end(JSON.stringify({ documents }));
          })
          .catch((error) => {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(error) }));
          });
      });
    },
  };
}
export async function readLocalDomMotionDocuments(root: string = ROOT) {
  let names: string[];
  try {
    names = await readdir(root);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return [];
    throw error;
  }
  const canonicalRoot = await realpath(root);
  const documents = [];
  for (const name of names.sort()) {
    if (!/^[a-zA-Z0-9_-]+\.sniptale-dom-motion\.json$/.test(name)) continue;
    if (documents.length >= 16)
      throw new Error("DOM motion catalog size exceeded");
    const path = await realpath(resolve(root, name));
    const local = relative(canonicalRoot, path);
    if (local.startsWith("..") || isAbsolute(local))
      throw new Error("DOM motion source outside catalog");
    const source = await readFile(path, "utf8");
    if (source.length > 13_000_000)
      throw new Error("DOM motion source too large");
    documents.push(parseDomMotionDocument(JSON.parse(source)));
  }
  return documents;
}
