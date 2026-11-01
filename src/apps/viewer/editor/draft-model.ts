import { stableSerialize } from "../../../shared/serialization/stable-json.js";
import type { EditorSnapshot } from "./history.js";

export const EDITOR_DRAFT_SCHEMA_VERSION = 1;
export const EDITOR_DRAFT_HISTORY_LIMIT = 80;
export const EDITOR_DRAFT_MAX_RECORDS = 24;
export const EDITOR_DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

export type EditorDraftRecord = {
  current: EditorSnapshot;
  historyFuture: EditorSnapshot[];
  historyPast: EditorSnapshot[];
  key: string;
  packId: string;
  schemaVersion: number;
  sessionId: string;
  sourceFingerprint: string;
  templateId: string;
  updatedAt: number;
};

export function getEditorDraftCleanupKeys(
  value: unknown,
  now: number,
): string[] {
  const values: unknown[] = Array.isArray(value) ? value : [];
  const records = values.filter(
    (item): item is Record<string, unknown> & { key: string } =>
      isRecord(item) && typeof item.key === "string",
  );
  const keep = records
    .filter(
      (
        record,
      ): record is Record<string, unknown> & {
        key: string;
        updatedAt: number;
      } =>
        typeof record.updatedAt === "number" &&
        Number.isFinite(record.updatedAt) &&
        now - record.updatedAt <= EDITOR_DRAFT_MAX_AGE_MS,
    )
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, EDITOR_DRAFT_MAX_RECORDS);
  const keepKeys = new Set(keep.map((record) => record.key));
  return records
    .map((record) => record.key)
    .filter((key) => !keepKeys.has(key));
}

export function createEditorDraftKey(
  packId: string,
  templateId: string,
  sourceFingerprint: string,
): string {
  return [packId, templateId, sourceFingerprint]
    .map((part) => encodeURIComponent(String(part)))
    .join("::");
}

export function fingerprintEditorValue(value: unknown): string {
  return hashString(stableSerialize(value));
}

export function normalizeEditorDraftRecord(
  value: unknown,
  expected: {
    key: string;
    packId: string;
    sourceFingerprint: string;
    templateId: string;
  },
): EditorDraftRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    value.schemaVersion !== EDITOR_DRAFT_SCHEMA_VERSION ||
    value.key !== expected.key ||
    value.packId !== expected.packId ||
    value.sourceFingerprint !== expected.sourceFingerprint ||
    value.templateId !== expected.templateId ||
    typeof value.sessionId !== "string" ||
    typeof value.updatedAt !== "number" ||
    !Number.isFinite(value.updatedAt)
  ) {
    return null;
  }
  const current = normalizeEditorSnapshot(value.current, expected.templateId);
  if (!current) {
    return null;
  }
  return {
    current,
    historyFuture: normalizeHistory(value.historyFuture, expected.templateId),
    historyPast: normalizeHistory(value.historyPast, expected.templateId),
    key: expected.key,
    packId: expected.packId,
    schemaVersion: EDITOR_DRAFT_SCHEMA_VERSION,
    sessionId: value.sessionId,
    sourceFingerprint: expected.sourceFingerprint,
    templateId: expected.templateId,
    updatedAt: value.updatedAt,
  };
}

export function hasEditorDraftWriteConflict(
  existing: EditorDraftRecord | null,
  options: { loadedUpdatedAt: number; sessionId: string },
): boolean {
  return Boolean(
    existing &&
    existing.sessionId !== options.sessionId &&
    existing.updatedAt > options.loadedUpdatedAt,
  );
}

function normalizeHistory(
  value: unknown,
  templateId: string,
): EditorSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((snapshot) => normalizeEditorSnapshot(snapshot, templateId))
    .filter((snapshot): snapshot is EditorSnapshot => Boolean(snapshot))
    .slice(-EDITOR_DRAFT_HISTORY_LIMIT);
}

function normalizeEditorSnapshot(
  value: unknown,
  templateId: string,
): EditorSnapshot | null {
  const controls = cloneJsonValue(isRecord(value) ? value.controls : null);
  const editorCommands = cloneJsonValue(
    isRecord(value) ? value.editorCommands : null,
  );
  const editorOverride = cloneJsonValue(
    isRecord(value) ? value.editorOverride : undefined,
  );
  const timelineOverride = cloneJsonValue(
    isRecord(value) ? value.timelineOverride : undefined,
  );
  const selectedItem = cloneJsonValue(
    isRecord(value) ? value.selectedItem : undefined,
  );
  const legacySelectedKeyframe = cloneJsonValue(
    isRecord(value) ? value.selectedKeyframe : undefined,
  );
  if (
    !isRecord(value) ||
    value.templateId !== templateId ||
    typeof value.label !== "string" ||
    typeof value.time !== "number" ||
    !Number.isFinite(value.time) ||
    !isNullableRecord(editorOverride) ||
    !isNullableRecord(timelineOverride) ||
    !isRecord(controls) ||
    !Array.isArray(editorCommands)
  ) {
    return null;
  }
  const assetEntries = normalizeAssetEntries(value.assetEntries);
  const assetScopeIds = normalizeStringArray(value.assetScopeIds);
  const selectedKeyframes = normalizeJsonArray(value.selectedKeyframes);
  return {
    assetEntries,
    assetScopeIds,
    controls,
    editorCommands,
    editorOverride,
    label: value.label,
    selectedClips: normalizeJsonArray(value.selectedClips),
    selectedItem: isRecord(selectedItem) ? selectedItem : { type: "effect" },
    selectedKeyframes:
      selectedKeyframes.length > 0
        ? selectedKeyframes
        : isRecord(legacySelectedKeyframe)
          ? [legacySelectedKeyframe]
          : [],
    selectedLayers: normalizeJsonArray(value.selectedLayers),
    selectedPhases: normalizeJsonArray(value.selectedPhases),
    selectedPresetId:
      typeof value.selectedPresetId === "string"
        ? value.selectedPresetId
        : null,
    selectedScenes: normalizeJsonArray(value.selectedScenes),
    templateId,
    time: value.time,
    timelineOverride,
  };
}

function normalizeAssetEntries(value: unknown): [string, unknown][] {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries: [string, unknown][] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== "string" ||
      !isRecord(entry[1]) ||
      seen.has(entry[0])
    ) {
      continue;
    }
    seen.add(entry[0]);
    entries.push([entry[0], entry[1]]);
  }
  return entries;
}

function normalizeJsonArray(value: unknown): unknown[] {
  const clone = cloneJsonValue(value);
  return Array.isArray(clone) ? clone : [];
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter((item): item is string => typeof item === "string"),
        ),
      ]
    : [];
}

function isNullableRecord(value: unknown): boolean {
  return value === null || isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJsonValue(value: unknown): unknown {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? undefined : JSON.parse(serialized);
  } catch {
    return undefined;
  }
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
