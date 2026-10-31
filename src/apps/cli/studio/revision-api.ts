import type { IncomingMessage, ServerResponse } from "node:http";
import { MAX_STUDIO_SOURCE_BYTES } from "../../../shared/studio/protocol.js";
import {
  isRecord,
  isStudioEffectId,
  isStudioFingerprint,
  isStudioRevisionId,
  STUDIO_REVISIONS_ROUTE,
} from "../../../shared/studio/revision-contract.js";
import { adoptStudioRevision, saveStudioRevision } from "./revision-store.js";
import { listStudioRevisions, readStudioEffect } from "./revision-reader.js";
import { StudioRevisionError } from "./revision-error.js";

export async function handleStudioRevisionRequest(
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
  project: string,
  origin: string,
): Promise<void> {
  const controller = new AbortController();
  const close = () => controller.abort();
  response.once("close", close);
  try {
    let result: unknown;
    if (request.method === "GET") {
      const id = new URL(request.url ?? "/", origin).searchParams.get(
        "effectId",
      );
      if (!isStudioEffectId(id))
        throw new StudioRevisionError("EFFECT_ID", "Invalid effect id.");
      result =
        path === STUDIO_REVISIONS_ROUTE
          ? { ok: true, revisions: await listStudioRevisions(project, id) }
          : {
              ok: true,
              selection: (await readStudioEffect(project, id)).selection,
            };
    } else if (request.method === "POST") {
      if (request.headers.origin !== origin) {
        json(response, 403, { ok: false, code: "ORIGIN" });
        return;
      }
      if (
        !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
          request.headers["content-type"] ?? "",
        )
      ) {
        json(response, 415, { ok: false, code: "CONTENT_TYPE" });
        return;
      }
      const value = await readBody(request);
      if (!isRecord(value) || !isStudioEffectId(value.effectId))
        throw new StudioRevisionError(
          "REVISION_REQUEST",
          "Invalid revision request.",
        );
      if (path === STUDIO_REVISIONS_ROUTE) {
        if (
          typeof value.source !== "string" ||
          !isStudioFingerprint(value.baseRevision)
        )
          throw new StudioRevisionError(
            "REVISION_REQUEST",
            "Invalid revision request.",
          );
        result = {
          ok: true,
          ...(await saveStudioRevision(
            project,
            value.effectId,
            { source: value.source, baseRevision: value.baseRevision },
            controller.signal,
          )),
        };
      } else {
        if (
          !(value.revisionId === null || isStudioRevisionId(value.revisionId))
        )
          throw new StudioRevisionError(
            "REVISION_REQUEST",
            "Invalid selection request.",
          );
        result = {
          ok: true,
          selection: await adoptStudioRevision(
            project,
            value.effectId,
            isStudioRevisionId(value.revisionId) ? value.revisionId : null,
          ),
        };
      }
    } else {
      json(response, 405, { ok: false, code: "METHOD" });
      return;
    }
    json(
      response,
      request.method === "POST" && path === STUDIO_REVISIONS_ROUTE ? 201 : 200,
      result,
    );
  } catch (error) {
    const code =
      error instanceof StudioRevisionError
        ? error.code
        : isRecord(error) &&
            typeof error.code === "string" &&
            /^[A-Z_]+$/.test(error.code)
          ? error.code
          : "REVISION_FAILED";
    const status =
      code === "BODY_LIMIT"
        ? 413
        : code === "EEXIST"
          ? 409
          : error instanceof StudioRevisionError || error instanceof SyntaxError
            ? 400
            : 500;
    json(response, status, { ok: false, code });
  } finally {
    response.off("close", close);
  }
}
function json(response: ServerResponse, status: number, value: unknown): void {
  if (response.destroyed || response.headersSent) return;
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    Connection: "close",
  });
  response.end(JSON.stringify(value));
}
function readBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const maximum = MAX_STUDIO_SOURCE_BYTES * 2 + 4096;
    const cleanup = () => {
      request.off("data", data);
      request.off("end", end);
      request.off("aborted", aborted);
      request.off("error", fail);
    };
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const aborted = () => fail(new Error("Request aborted."));
    const data = (chunk: unknown) => {
      if (!Buffer.isBuffer(chunk)) {
        fail(
          new StudioRevisionError("BODY_INVALID", "Expected request bytes."),
        );
        return;
      }
      total += chunk.length;
      if (total > maximum) {
        request.pause();
        fail(
          new StudioRevisionError(
            "BODY_LIMIT",
            "Request exceeds the size limit.",
          ),
        );
        return;
      }
      chunks.push(chunk);
    };
    const end = () => {
      cleanup();
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    };
    if (Number(request.headers["content-length"]) > maximum) {
      reject(
        new StudioRevisionError(
          "BODY_LIMIT",
          "Request exceeds the size limit.",
        ),
      );
      return;
    }
    request.on("data", data);
    request.once("end", end);
    request.once("aborted", aborted);
    request.once("error", fail);
  });
}
