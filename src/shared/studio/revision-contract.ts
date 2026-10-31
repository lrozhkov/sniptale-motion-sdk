export const STUDIO_REVISIONS_ROUTE = "/__sniptale/studio/revisions";
export const STUDIO_SELECTION_ROUTE = "/__sniptale/studio/selection";
export const STUDIO_REVISION_SCHEMA = "sniptale.motion-revision.v1";
export const STUDIO_SELECTION_SCHEMA = "sniptale.motion-selection.v1";

export type StudioEffectSelection = {
  effectId: string;
  revisionId: string | null;
  fingerprint: string;
};
export type StudioRevision = {
  schemaVersion: typeof STUDIO_REVISION_SCHEMA;
  effectId: string;
  revisionId: string;
  createdAt: string;
  baseRevision: string;
  sourceRevisionAtSave: string | null;
  documentSha256: string;
  documentBytes: number;
};
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function isStudioEffectId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-z][a-z0-9_-]{0,63}$/.test(value) &&
    !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(value)
  );
}
export function isStudioRevisionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      value,
    )
  );
}
export function isStudioFingerprint(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
export function parseStudioEffectSelection(
  value: unknown,
): StudioEffectSelection | null {
  if (
    !isRecord(value) ||
    !isStudioEffectId(value.effectId) ||
    !(value.revisionId === null || isStudioRevisionId(value.revisionId)) ||
    !isStudioFingerprint(value.fingerprint)
  )
    return null;
  return {
    effectId: value.effectId,
    revisionId: isStudioRevisionId(value.revisionId) ? value.revisionId : null,
    fingerprint: value.fingerprint,
  };
}
export function parseStudioRevision(value: unknown): StudioRevision | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== STUDIO_REVISION_SCHEMA ||
    !isStudioEffectId(value.effectId) ||
    !isStudioRevisionId(value.revisionId) ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !isStudioFingerprint(value.baseRevision) ||
    !(
      value.sourceRevisionAtSave === null ||
      isStudioFingerprint(value.sourceRevisionAtSave)
    ) ||
    !isStudioFingerprint(value.documentSha256) ||
    typeof value.documentBytes !== "number" ||
    !Number.isSafeInteger(value.documentBytes) ||
    value.documentBytes <= 0
  )
    return null;
  return {
    schemaVersion: STUDIO_REVISION_SCHEMA,
    effectId: value.effectId,
    revisionId: value.revisionId,
    createdAt: value.createdAt,
    baseRevision: value.baseRevision,
    sourceRevisionAtSave: isStudioFingerprint(value.sourceRevisionAtSave)
      ? value.sourceRevisionAtSave
      : null,
    documentSha256: value.documentSha256,
    documentBytes: value.documentBytes,
  };
}
