import { describe, expect, it } from "vitest";

import {
  EDITOR_DRAFT_HISTORY_LIMIT,
  EDITOR_DRAFT_MAX_AGE_MS,
  EDITOR_DRAFT_MAX_RECORDS,
  getEditorDraftCleanupKeys,
  EDITOR_DRAFT_SCHEMA_VERSION,
  createEditorDraftKey,
  fingerprintEditorValue,
  hasEditorDraftWriteConflict,
  normalizeEditorDraftRecord,
} from "../src/apps/viewer/editor/draft-model";
import { createEditorDraftStorage } from "../src/apps/viewer/editor/draft-storage";
import type { EditorSnapshot } from "../src/apps/viewer/editor/history";

describe("viewer editor draft model", () => {
  it("accepts finite snapshot times without coercing external draft fields", () => {
    const expected = {
      key: "draft",
      packId: "pack",
      templateId: "template",
      sourceFingerprint: "source",
    };
    const calls: string[] = [];
    const foreign = {
      valueOf() {
        calls.push("time");
        return 0;
      },
    };
    const record = {
      ...expected,
      schemaVersion: EDITOR_DRAFT_SCHEMA_VERSION,
      sessionId: "session",
      updatedAt: 1,
      historyPast: [],
      historyFuture: [],
      current: snapshot("template"),
    };
    for (const time of ["0", foreign, NaN, Infinity])
      expect(
        normalizeEditorDraftRecord(
          { ...record, current: { ...record.current, time } },
          expected,
        ),
      ).toBeNull();
    expect(
      normalizeEditorDraftRecord({ ...record, updatedAt: foreign }, expected),
    ).toBeNull();
    expect(normalizeEditorDraftRecord(record, expected)?.current.time).toBe(0);
    expect(calls).toEqual([]);
  });

  it("validates stored cleanup metadata and retains the newest eligible records", () => {
    const now = EDITOR_DRAFT_MAX_AGE_MS + 1000;
    const latest = Array.from(
      { length: EDITOR_DRAFT_MAX_RECORDS },
      (_, index) => ({ key: `keep-${index}`, updatedAt: now - index }),
    );
    const records: unknown[] = [
      ...latest,
      null,
      [],
      { key: 7, updatedAt: now },
      { key: "missing-time" },
      { key: "string-time", updatedAt: String(now) },
      { key: "not-finite", updatedAt: Infinity },
      { key: "old", updatedAt: 0 },
      { key: "overflow", updatedAt: now - 100 },
    ];
    expect(getEditorDraftCleanupKeys(records, now)).toEqual([
      "missing-time",
      "string-time",
      "not-finite",
      "old",
      "overflow",
    ]);
    expect(getEditorDraftCleanupKeys({ records: latest }, now)).toEqual([]);
    expect(records.slice(0, latest.length)).toEqual(latest);
  });

  it("creates stable source fingerprints and scoped storage keys", () => {
    expect(fingerprintEditorValue({ a: 1, b: [2, 3] })).toBe(
      fingerprintEditorValue({ b: [2, 3], a: 1 }),
    );
    expect(fingerprintEditorValue({ a: 2 })).not.toBe(
      fingerprintEditorValue({ a: 1 }),
    );
    expect(createEditorDraftKey("pack/a", "template:b", "source hash")).toBe(
      "pack%2Fa::template%3Ab::source%20hash",
    );
  });

  it("validates unknown records, trims history, and preserves asset blobs", () => {
    const expected = {
      key: "pack::template::source",
      packId: "pack",
      sourceFingerprint: "source",
      templateId: "template",
    };
    const blob = new Blob(["asset"], { type: "image/png" });
    const current = snapshot("template", {
      assetEntries: [["image", { blob, id: "image" }]],
      assetScopeIds: ["image", "image"],
    });
    const record = normalizeEditorDraftRecord(
      {
        ...expected,
        current,
        historyFuture: [snapshot("other")],
        historyPast: Array.from(
          { length: EDITOR_DRAFT_HISTORY_LIMIT + 5 },
          (_, index) => snapshot("template", { label: `edit-${index}` }),
        ),
        schemaVersion: EDITOR_DRAFT_SCHEMA_VERSION,
        sessionId: "session-a",
        updatedAt: 42,
      },
      expected,
    );

    expect(record?.historyPast).toHaveLength(EDITOR_DRAFT_HISTORY_LIMIT);
    expect(record?.historyPast[0].label).toBe("edit-5");
    expect(record?.historyFuture).toEqual([]);
    expect(record?.current.assetScopeIds).toEqual(["image"]);
    const restoredAsset = record?.current.assetEntries[0][1];
    if (
      !restoredAsset ||
      typeof restoredAsset !== "object" ||
      !("blob" in restoredAsset)
    ) {
      throw new Error("Expected draft asset record with a blob.");
    }
    expect(restoredAsset.blob).toBe(blob);
    expect(
      normalizeEditorDraftRecord(
        {
          ...record,
          sourceFingerprint: "stale-source",
        },
        expected,
      ),
    ).toBeNull();
    expect(normalizeEditorDraftRecord({ broken: true }, expected)).toBeNull();
    expect(
      normalizeEditorDraftRecord(
        {
          ...record,
          current: { ...current, controls: { unsafe: 1n } },
        },
        expected,
      ),
    ).toBeNull();
    const circular: any = {};
    circular.self = circular;
    expect(
      normalizeEditorDraftRecord(
        {
          ...record,
          current: { ...current, editorOverride: circular },
        },
        expected,
      ),
    ).toBeNull();
  });

  it("prevents a stale tab from overwriting a newer foreign draft", () => {
    const existing = {
      current: snapshot("template"),
      historyFuture: [],
      historyPast: [],
      key: "key",
      packId: "pack",
      schemaVersion: EDITOR_DRAFT_SCHEMA_VERSION,
      sessionId: "other-session",
      sourceFingerprint: "source",
      templateId: "template",
      updatedAt: 200,
    };
    expect(
      hasEditorDraftWriteConflict(existing, {
        loadedUpdatedAt: 100,
        sessionId: "this-session",
      }),
    ).toBe(true);
    expect(
      hasEditorDraftWriteConflict(existing, {
        loadedUpdatedAt: 200,
        sessionId: "this-session",
      }),
    ).toBe(false);
    expect(
      hasEditorDraftWriteConflict(existing, {
        loadedUpdatedAt: 0,
        sessionId: "other-session",
      }),
    ).toBe(false);
  });

  it("migrates the legacy primary keyframe into the canonical selection set", () => {
    const normalized = normalizeEditorDraftRecord(
      {
        current: snapshot("template", {
          selectedKeyframe: {
            keyframeId: "end",
            trackId: "opacity",
          },
          selectedKeyframes: undefined as any,
        }),
        historyFuture: [],
        historyPast: [],
        key: "pack::template::source",
        packId: "pack",
        schemaVersion: EDITOR_DRAFT_SCHEMA_VERSION,
        sessionId: "legacy-session",
        sourceFingerprint: "source",
        templateId: "template",
        updatedAt: 42,
      },
      {
        key: "pack::template::source",
        packId: "pack",
        sourceFingerprint: "source",
        templateId: "template",
      },
    );

    expect(normalized?.current.selectedKeyframes).toEqual([
      { keyframeId: "end", trackId: "opacity" },
    ]);
    expect(normalized?.current).not.toHaveProperty("selectedKeyframe");
  });

  it("fails cleanly when browser draft storage is unavailable", async () => {
    const storage = createEditorDraftStorage(undefined);
    await expect(storage.get("draft")).rejects.toThrow(
      "IndexedDB is unavailable",
    );
  });
});

function snapshot(
  templateId: string,
  patch: Partial<EditorSnapshot> = {},
): EditorSnapshot {
  return {
    assetEntries: [],
    assetScopeIds: [],
    controls: {},
    editorCommands: [],
    editorOverride: null,
    label: "edit",
    selectedClips: [],
    selectedItem: { type: "effect" },
    selectedKeyframes: [],
    selectedLayers: [],
    selectedPhases: [],
    selectedPresetId: null,
    selectedScenes: [],
    templateId,
    time: 0,
    timelineOverride: null,
    ...patch,
  };
}
