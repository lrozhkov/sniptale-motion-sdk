import type { PreviewMediaEntry } from "../src/apps/viewer/preview-media/frame-source.js";
import type { PreviewMediaSlot } from "../src/apps/viewer/preview-media/model.js";
import type { PlaybackRunState } from "../src/apps/viewer/playback/state.js";
import type { GraphEditorViewport } from "../src/apps/viewer/graph-editor/state.js";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createViewerState } from "../src/apps/viewer/app/state.js";
import {
  captureEditorSnapshot,
  restoreEditorSnapshotState,
} from "../src/apps/viewer/editor/history.js";
import type { EditorSnapshot } from "../src/apps/viewer/editor/history.js";
import type { EditorDraftState } from "../src/apps/viewer/editor/state.js";
import type { EditorTemplateSource } from "../src/apps/viewer/templates/model.js";
import { readEditorTemplateSource } from "../src/apps/viewer/templates/source.js";

describe("viewer state contracts", () => {
  it("exposes typed editor state without a root any", () => {
    const state = createViewerState();
    expectTypeOf(state).not.toBeAny();
    expectTypeOf(state.controls).toEqualTypeOf<Record<string, unknown>>();
    expectTypeOf(state.editorOverrides).toEqualTypeOf<Map<string, unknown>>();
    expectTypeOf(state.editorDraft).toEqualTypeOf<EditorDraftState>();
    expectTypeOf(state.historyPast).toEqualTypeOf<EditorSnapshot[]>();
    expectTypeOf(
      state.currentTemplate,
    ).toEqualTypeOf<EditorTemplateSource | null>();
    expectTypeOf(state.selectedLayers).toEqualTypeOf<string[]>();
    expectTypeOf(state.previewMediaInputs).toEqualTypeOf<
      Map<PreviewMediaSlot, PreviewMediaEntry>
    >();
    expectTypeOf(state.previewMediaLoadGeneration).toEqualTypeOf<
      Map<PreviewMediaSlot, number>
    >();
    expectTypeOf(state.playbackRun).toEqualTypeOf<PlaybackRunState>();
    expectTypeOf(
      state.graphEditorViewport,
    ).toEqualTypeOf<GraphEditorViewport | null>();
    expectTypeOf(state.canvasIsolationGroupId).toEqualTypeOf<string | null>();
  });

  it("isolates editor state across viewer sessions", () => {
    const first = createViewerState();
    const second = createViewerState();
    first.controls.opaque = { retained: true };
    first.editorOverrides.set("source", { duration: 0.02 });
    first.historyPast.push(captureEditorSnapshot(first, "change", "source", 0));
    first.editorDraft.revision += 1;
    first.selectedLayers.push("title");
    first.previewMediaLoadGeneration.set("source", 1);
    first.playbackRun.generation += 1;
    first.canvasMotionPathContextLayerIds.push("title");
    expect(second.controls).toEqual({});
    expect(second.editorOverrides.size).toBe(0);
    expect(second.historyPast).toEqual([]);
    expect(second.editorDraft.revision).toBe(0);
    expect(second.selectedLayers).toEqual([]);
    expect(second.previewMediaLoadGeneration.size).toBe(0);
    expect(second.playbackRun.generation).toBe(0);
    expect(second.canvasMotionPathContextLayerIds).toEqual([]);
  });

  it("parses restored selection and controls before writing typed state", () => {
    const state = createViewerState();
    const snapshot = captureEditorSnapshot(state, "restore", "source", 0);
    snapshot.selectedItem = { type: "layer", layerId: { toString: 0 } };
    snapshot.selectedLayers = ["title", 42, null];
    snapshot.selectedKeyframes = [
      null,
      { trackId: "title.x", keyframeId: "k" },
    ];
    snapshot.controls = { opacity: 0, extension: { retained: true } };
    restoreEditorSnapshotState(state, snapshot);
    expect(state.selectedItem).toEqual({ type: "effect" });
    expect(state.selectedLayers).toEqual(["title"]);
    expect(state.selectedKeyframes).toEqual([
      { trackId: "title.x", keyframeId: "k" },
    ]);
    expect(state.controls).toEqual(snapshot.controls);
    const before = structuredClone(state.controls);
    snapshot.controls = [];
    snapshot.editorOverride = { duration: 99 };
    expect(() => restoreEditorSnapshotState(state, snapshot)).toThrow(
      /Invalid editor snapshot controls/,
    );
    expect(state.controls).toEqual(before);
    expect(state.editorOverrides.has("source")).toBe(false);
  });

  it("reads optional source data without fabricating an effective template", () => {
    const source = {
      id: "source",
      duration: 0.02,
      timeline: { extension: "opaque" },
      extension: { retained: true },
    };
    const parsed = readEditorTemplateSource(source);
    expect(parsed).toBe(source);
    expect(parsed).not.toHaveProperty("layers");
    expectTypeOf(parsed.timeline).toBeUnknown();
  });

  it.each([
    { id: "source" },
    { id: "source", duration: Infinity },
    { id: "source", duration: 1, default: "yes" },
    { id: "source", duration: 1, layers: [{ id: "title" }] },
    { id: "source", duration: 1, controls: [{ id: "opacity" }] },
  ])("rejects malformed template state input: %j", (value) => {
    expect(() => readEditorTemplateSource(value)).toThrow(
      /Invalid editor template source structure/,
    );
  });
});
