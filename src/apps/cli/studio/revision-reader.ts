import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { materializeEffectV1Bundle } from "../bundle-source.js";
import { readBoundedFile, resolveContainedFile } from "../files.js";
import { parseEffectV1Source } from "../../../sdk/effect-v1/index.js";
import { MAX_STUDIO_SOURCE_BYTES } from "../../../shared/studio/protocol.js";
import {
  isRecord,
  isStudioRevisionId,
  parseStudioRevision,
  STUDIO_SELECTION_SCHEMA,
  type StudioEffectSelection,
  type StudioRevision,
} from "../../../shared/studio/revision-contract.js";
import { StudioRevisionError } from "./revision-error.js";
import {
  DOCUMENT_FILE,
  COMMIT_FILE,
  SELECTION_FILE,
  effectDirectory,
  isMissing,
} from "./revision-files.js";

export function digest(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

export async function readSelection(directory: string): Promise<string | null> {
  let bytes: Buffer;
  try {
    bytes = await readBoundedFile(join(directory, SELECTION_FILE), 4096);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  const value: unknown = JSON.parse(bytes.toString("utf8"));
  if (
    !isRecord(value) ||
    value.schemaVersion !== STUDIO_SELECTION_SCHEMA ||
    !(value.revisionId === null || isStudioRevisionId(value.revisionId))
  )
    throw new StudioRevisionError(
      "SELECTION_INVALID",
      "Project selection metadata is invalid.",
    );
  return isStudioRevisionId(value.revisionId) ? value.revisionId : null;
}

export async function sourceDocument(
  source: string,
  id: string,
  assetRoot: string,
): Promise<string> {
  const materialized = await materializeEffectV1Bundle(source, assetRoot);
  if (Buffer.byteLength(materialized) > MAX_STUDIO_SOURCE_BYTES)
    throw new StudioRevisionError(
      "SOURCE_LIMIT",
      "The document exceeds the size limit.",
    );
  const validation = parseEffectV1Source(materialized);
  if (!validation.ok || validation.document?.id !== id)
    throw new StudioRevisionError(
      "DOCUMENT_INVALID",
      "Expected a valid Effect v1 document with the project effect id.",
    );
  return materialized;
}

export async function readStudioEffect(
  project: string,
  id: string,
): Promise<{
  source: string;
  directory: string;
  selection: StudioEffectSelection;
}> {
  const directory = await effectDirectory(project, id);
  const revisionId = await readSelection(directory);
  const source = revisionId
    ? (await readStudioRevision(project, id, revisionId)).source
    : await sourceDocument(
        (
          await readBoundedFile(
            await resolveContainedFile(directory, DOCUMENT_FILE),
            MAX_STUDIO_SOURCE_BYTES,
          )
        ).toString("utf8"),
        id,
        directory,
      );
  return {
    source,
    directory,
    selection: { effectId: id, revisionId, fingerprint: digest(source) },
  };
}

export function isRevisionSource(source: string, id: string): boolean {
  const parsed = parseEffectV1Source(source);
  return (
    parsed.ok &&
    parsed.document?.id === id &&
    parsed.document.assets.every(
      (asset) =>
        typeof asset.dataUrl === "string" || typeof asset.svgText === "string",
    )
  );
}

export async function readStudioRevision(
  project: string,
  id: string,
  revisionId: string,
): Promise<{ revision: StudioRevision; source: string }> {
  if (!isStudioRevisionId(revisionId))
    throw new StudioRevisionError("REVISION_ID", "Invalid revision id.");
  const directory = await effectDirectory(project, id);
  const target = await resolveContainedFile(
    directory,
    `revisions/${revisionId}`,
  );
  const revision = parseStudioRevision(
    JSON.parse(
      (
        await readBoundedFile(
          await resolveContainedFile(target, COMMIT_FILE),
          4096,
        )
      ).toString("utf8"),
    ),
  );
  if (
    !revision ||
    revision.effectId !== id ||
    revision.revisionId !== revisionId
  )
    throw new StudioRevisionError(
      "REVISION_INVALID",
      "Revision metadata is invalid.",
    );
  const source = (
    await readBoundedFile(
      await resolveContainedFile(target, DOCUMENT_FILE),
      MAX_STUDIO_SOURCE_BYTES,
    )
  ).toString("utf8");
  if (
    Buffer.byteLength(source) !== revision.documentBytes ||
    digest(source) !== revision.documentSha256 ||
    !isRevisionSource(source, id)
  )
    throw new StudioRevisionError(
      "REVISION_INVALID",
      "Revision document integrity check failed.",
    );
  return { revision, source };
}

export async function observeCurrent(
  project: string,
  id: string,
): Promise<string | null> {
  try {
    return (await readStudioEffect(project, id)).selection.fingerprint;
  } catch {
    return null;
  }
}

export async function listStudioRevisions(
  project: string,
  id: string,
): Promise<StudioRevision[]> {
  const directory = await effectDirectory(project, id);
  let entries;
  try {
    entries = await readdir(
      await resolveContainedFile(directory, "revisions"),
      { withFileTypes: true },
    );
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  const result: StudioRevision[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isStudioRevisionId(entry.name)) continue;
    try {
      result.push((await readStudioRevision(project, id, entry.name)).revision);
    } catch {
      /* Incomplete or damaged revisions are never accepted. */
    }
  }
  return result.sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.revisionId.localeCompare(left.revisionId),
  );
}
