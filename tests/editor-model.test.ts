import type { EditorHistoryState } from "../src/apps/viewer/editor/history.js";
import { describe, expect, it } from "vitest";

import { setLocale } from "../src/shared/i18n";

import {
  captureEditorSnapshot,
  commitEditorHistory,
  createEditorCommand,
  recordEditorCommand,
  restoreEditorSnapshotState,
} from "../src/apps/viewer/editor/history";
import {
  appendCopyLabel,
  buildControlsWithDefaults,
  createUniquePresetId,
  normalizePresets,
  normalizeScenes,
  normalizeTimeline,
} from "../src/apps/viewer/editor/model";

describe("viewer editor model", () => {
  it("preserves preset timeline timing and extension fields without normalization", () => {
    const timeline = {
      phases: [{ id: "short", duration: 0.02, start: 0.001 }],
      tracks: [],
      extension: { source: "author" },
    };
    const presets = normalizePresets([{ id: "precise", timeline }]);
    expect(presets[0].timeline).toEqual(timeline);
    expect(presets[0].timeline).not.toBe(timeline);
    expect(normalizePresets([{ id: 7, timeline: "legacy" }])).toMatchObject([
      { id: "7", timeline: "legacy" },
    ]);
  });

  it("preserves opaque preset payloads and localized metadata without adding defaults", () => {
    const preset = {
      id: "precise",
      label: "Original",
      controls: { speed: 0 },
      scenes: [
        {
          id: "intro",
          start: 0.001,
          duration: 0.019,
          label: { ru: "Вступление", en: "Intro" },
          extension: { marker: 7 },
        },
      ],
      extension: { author: "source" },
    };
    const before = structuredClone(preset);
    for (const locale of ["ru", "en"] as const) {
      setLocale(locale);
      const normalized = normalizePresets([preset])[0];
      expect(normalized).toEqual(preset);
      expect(normalized).not.toBe(preset);
      expect(normalized?.scenes).not.toBe(preset.scenes);
      expect(normalized).not.toHaveProperty("duration");
      expect(normalized).not.toHaveProperty("timeline");
    }
    setLocale("ru");
    expect(preset).toEqual(before);
  });

  it("parses malformed nested records without coercing object fields", () => {
    const invalidNumber = { toString: 0 };
    expect(() =>
      normalizeScenes(
        [
          null,
          [],
          { id: invalidNumber, duration: invalidNumber, start: Infinity },
        ],
        2,
      ),
    ).not.toThrow();
    expect(
      normalizeScenes(
        [null, [], { id: invalidNumber, duration: invalidNumber }],
        2,
      ),
    ).toMatchObject([{ id: "scene-1", duration: 2 }]);
    expect(
      normalizeTimeline(
        {
          phases: [null, [], { id: "p", duration: Infinity }],
          tracks: [
            null,
            [],
            {
              id: "t",
              keyframes: [
                null,
                [],
                {
                  id: "k",
                  time: invalidNumber,
                  value: 1,
                  handles: { x1: invalidNumber },
                },
              ],
            },
          ],
        },
        2,
      ),
    ).toMatchObject({
      phases: [{ id: "p", duration: 0.05 }],
      tracks: [
        { id: "t", keyframes: [{ id: "k", time: 0, handles: { x1: 0 } }] },
      ],
    });
    expect(appendCopyLabel({ en: [], ru: "Текст" })).toEqual({
      en: "Текст Copy",
      ru: "Текст — копия",
    });
  });

  it("normalizes scenes, presets, timeline, and controls", () => {
    expect(normalizeScenes([], 3)).toEqual([
      {
        duration: 3,
        id: "main",
        label: "Main",
        locked: false,
        start: 0,
        transition: null,
      },
    ]);
    expect(
      normalizePresets([
        {
          duration: 2,
          id: "preset-a",
          label: { ru: "Пресет" },
          scenes: [{ id: "s1", start: 0, duration: 2 }],
        },
      ]),
    ).toMatchObject([{ id: "preset-a", scenes: [{ id: "s1" }] }]);
    const timeline = normalizeTimeline(
      {
        tracks: [
          {
            id: "track",
            keyframes: [
              { id: "b", time: 2, value: 2 },
              { id: "a", time: 1, value: 1 },
            ],
          },
        ],
      },
      4,
    );
    expect(timeline.tracks[0].keyframes.map((keyframe) => keyframe.id)).toEqual(
      ["a", "b"],
    );
    expect(timeline.tracks[0].label).toBe("");
    expect(
      buildControlsWithDefaults(
        {
          controls: [
            { id: "speed", defaultValue: 1 },
            { id: "color", defaultValue: "#fff" },
          ],
        },
        { speed: 2 },
      ),
    ).toEqual({ color: "#fff", speed: 2 });
  });

  it("creates deterministic preset ids and copy labels", () => {
    expect(createUniquePresetId([{ id: "preset" }], "preset")).toBe("preset-2");
    expect(appendCopyLabel({ en: "Clean", ru: "Чистый" })).toEqual({
      en: "Clean Copy",
      ru: "Чистый — копия",
    });
  });

  it("resolves localized scene, phase, and track labels without object coercion", () => {
    setLocale("ru");
    expect(
      normalizeScenes(
        [
          {
            duration: 2,
            id: "main",
            label: { en: "Main", ru: "Главная" },
            start: 0,
          },
        ],
        2,
      )[0].label,
    ).toBe("Главная");
    expect(
      normalizeTimeline(
        {
          phases: [
            {
              duration: 2,
              id: "intro",
              label: { en: "Intro", ru: "Вступление" },
              start: 0,
            },
          ],
          tracks: [
            {
              id: "title.opacity",
              label: { en: "Opacity", ru: "Прозрачность" },
            },
          ],
        },
        2,
      ),
    ).toMatchObject({
      phases: [{ label: "Вступление" }],
      tracks: [{ label: "Прозрачность" }],
    });
    setLocale("en");
    expect(
      normalizeScenes(
        [
          {
            duration: 2,
            id: "main",
            label: { en: "Main", ru: "Главная" },
            start: 0,
          },
        ],
        2,
      )[0].label,
    ).toBe("Main");
    setLocale("ru");
  });
});

describe("viewer editor history", () => {
  it("does not create override keys for a snapshot without a template", () => {
    const state = createHistoryState();
    const snapshot = captureEditorSnapshot(state, "empty", null, 0);
    snapshot.editorOverride = { duration: 99 };
    snapshot.timelineOverride = { duration: 99 };
    restoreEditorSnapshotState(state, snapshot);
    expect([...state.editorOverrides.keys()]).toEqual(["template-1"]);
    expect([...state.timelineOverrides.keys()]).toEqual(["template-1"]);
    expect(state.editorOverrides.get("template-1")).toEqual({ duration: 3 });
  });

  it("records commands and restores snapshots", () => {
    const state = createHistoryState();
    const command = createEditorCommand(
      { payload: { layerId: "logo" }, type: "moveLayer" },
      "template-1",
      1.25,
    );

    recordEditorCommand(state, command);
    const snapshot = captureEditorSnapshot(
      state,
      "before-change",
      "template-1",
      1.25,
    );
    expect(commitEditorHistory(state, snapshot)).toBe(true);
    expect(commitEditorHistory(state, snapshot)).toBe(false);

    state.editorOverrides.set("template-1", { duration: 7 });
    state.selectedItem = { type: "clip", layerId: "logo" };
    restoreEditorSnapshotState(state, snapshot);

    expect(state.editorCommands).toHaveLength(1);
    expect(state.editorOverrides.get("template-1")).toEqual({ duration: 3 });
    expect(state.selectedItem).toEqual({ type: "effect" });
    expect(state.historyPast).toHaveLength(1);
  });
});

function createHistoryState(): EditorHistoryState {
  return {
    controls: { speed: 2 },
    editorCommands: [],
    editorOverrides: new Map([["template-1", { duration: 3 }]]),
    historyFuture: [],
    historyPast: [],
    selectedClips: [],
    selectedLayers: [],
    selectedItem: { type: "effect" },
    selectedKeyframes: [],
    selectedPhases: [],
    selectedPresetId: null,
    selectedScenes: [],
    timelineOverrides: new Map([["template-1", { duration: 3 }]]),
  };
}
