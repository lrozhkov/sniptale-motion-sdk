import { randomUUID } from "node:crypto";
import { link, mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { readBoundedFile, resolveContainedFile } from "../files.js";
import { MAX_STUDIO_SOURCE_BYTES } from "../../../shared/studio/protocol.js";
import {
  isStudioFingerprint,
  STUDIO_REVISION_SCHEMA,
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
  ownedDirectory,
  writeExclusive,
  syncDirectory,
  stagingDirectory,
} from "./revision-files.js";
import {
  digest,
  readSelection,
  sourceDocument,
  readStudioEffect,
  isRevisionSource,
  readStudioRevision,
  observeCurrent,
} from "./revision-reader.js";

export async function saveStudioRevision(
  project: string,
  id: string,
  input: { source: string; baseRevision: string },
  signal?: AbortSignal,
): Promise<{ revision: StudioRevision; sourceChanged: boolean }> {
  const directory = await effectDirectory(project, id);
  if (
    !isStudioFingerprint(input.baseRevision) ||
    Buffer.byteLength(input.source) > MAX_STUDIO_SOURCE_BYTES
  )
    throw new StudioRevisionError(
      "REVISION_REQUEST",
      "Invalid revision request.",
    );
  if (!isRevisionSource(input.source, id))
    throw new StudioRevisionError(
      "DOCUMENT_INVALID",
      "A revision requires a valid self-contained Effect v1 document.",
    );
  const source = await sourceDocument(input.source, id, directory);
  const sourceRevisionAtSave = await observeCurrent(project, id);
  signal?.throwIfAborted();
  const revisionId = randomUUID();
  const parent = await ownedDirectory(directory, "revisions");
  const target = join(parent, revisionId);
  await mkdir(target); // Exclusive namespace claim. Never reuse an existing revision.
  await writeExclusive(join(target, DOCUMENT_FILE), source);
  await syncDirectory(target);
  signal?.throwIfAborted();
  const revision: StudioRevision = {
    schemaVersion: STUDIO_REVISION_SCHEMA,
    effectId: id,
    revisionId,
    createdAt: new Date().toISOString(),
    baseRevision: input.baseRevision,
    sourceRevisionAtSave,
    documentSha256: digest(source),
    documentBytes: Buffer.byteLength(source),
  };
  const staged = join(
    await stagingDirectory(project),
    `revision-${revisionId}.json`,
  );
  await writeExclusive(staged, `${JSON.stringify(revision)}\n`);
  try {
    signal?.throwIfAborted();
    await link(staged, join(target, COMMIT_FILE)); // Exclusive atomic publication of already synced metadata.
    await syncDirectory(target);
    await syncDirectory(parent);
  } finally {
    await rm(staged).catch(() => undefined);
  }
  return {
    revision,
    sourceChanged: (await observeCurrent(project, id)) !== input.baseRevision,
  };
}

export async function adoptStudioRevision(
  project: string,
  id: string,
  revisionId: string | null,
): Promise<StudioEffectSelection> {
  const directory = await effectDirectory(project, id);
  await readSelection(directory); // Do not replace unrelated or incompatible metadata.
  if (revisionId !== null) await readStudioRevision(project, id, revisionId);
  else
    await sourceDocument(
      (
        await readBoundedFile(
          await resolveContainedFile(directory, DOCUMENT_FILE),
          MAX_STUDIO_SOURCE_BYTES,
        )
      ).toString("utf8"),
      id,
      directory,
    );
  const temporary = join(
    await stagingDirectory(project),
    `selection-${randomUUID()}.json`,
  );
  await writeExclusive(
    temporary,
    `${JSON.stringify({ schemaVersion: STUDIO_SELECTION_SCHEMA, revisionId })}\n`,
  );
  try {
    await rename(temporary, join(directory, SELECTION_FILE));
    await syncDirectory(directory);
  } finally {
    await rm(temporary).catch(() => undefined);
  }
  return (await readStudioEffect(project, id)).selection;
}
