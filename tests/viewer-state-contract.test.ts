import type { TimelineRenderSnapshot } from "../src/apps/viewer/timeline/state.js";
import type {
  TimelineRowTree,
  TimelineTrackRow,
} from "../src/apps/viewer/timeline/model/row-tree-model.js";
import type { ViewerAppContext } from "../src/apps/viewer/app/context.js";
import type { TimelineNavigationItem } from "../src/apps/viewer/timeline/model/selection-model.js";
import type { TimelineExpansionType } from "../src/apps/viewer/timeline/model/row-tree-model.js";
import type { TimelineOrderedRow } from "../src/apps/viewer/timeline/virtualization/row-order-model.js";
import type { TimelineViewport } from "../src/apps/viewer/timeline/viewport.js";
import type {
  ClipMovePlan,
  PhaseMovePlan,
  SceneMovePlan,
} from "../src/apps/viewer/timeline/model/move-plan-model.js";
import type {
  OwnershipLinks,
  SelectedTimelineRange,
} from "../src/apps/viewer/timeline/model/ownership-model.js";
import type { CanvasTransformPreview } from "../src/apps/viewer/canvas/transform-state.js";
import type { KeyframeClipboardEntry } from "../src/apps/viewer/timeline/state.js";
import type { RendererBindingReads } from "../src/apps/viewer/app/binding-reads.js";
import type { ViewerRenderProfile } from "../src/apps/viewer/rendering/state.js";
import type { PreviewAudioState } from "../src/apps/viewer/playback/audio-state.js";
import type { PendingSandboxRequest } from "../src/apps/viewer/transport/state.js";
import type { Mp4ExportState } from "../src/apps/viewer/video-export/state.js";
import type { PlaybackVideoCacheState } from "../src/apps/viewer/playback/video-cache-state.js";
import type {
  RenderTemplateSnapshot,
  RenderOptions,
} from "../src/apps/viewer/rendering/state.js";
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
  it("keeps viewport geometry and row scope typed at the application boundary", () => {
    expectTypeOf<
      ReturnType<ViewerAppContext["getTimelineViewport"]>
    >().toEqualTypeOf<TimelineViewport>();
    expectTypeOf<
      ReturnType<ViewerAppContext["getTimelineContentRect"]>["left"]
    >().toBeNumber();
    expectTypeOf<
      ReturnType<ViewerAppContext["getTimelineItemRowIndex"]>
    >().toBeNumber();
    expectTypeOf<
      Parameters<ViewerAppContext["setTimelineRowExpanded"]>[0]
    >().toEqualTypeOf<TimelineExpansionType>();
    expectTypeOf<
      Exclude<
        Extract<TimelineOrderedRow, { globalScope: true }>["sceneId"],
        undefined
      >
    >().toBeNever();
    expectTypeOf<
      Extract<TimelineOrderedRow, { globalScope: false }>["sceneId"]
    >().toBeString();
  });

  it("keeps timeline nodes and ownership fields typed at the application boundary", () => {
    expectTypeOf<
      ReturnType<ViewerAppContext["createTimelineLane"]>["body"]
    >().toEqualTypeOf<HTMLDivElement>();
    expectTypeOf<
      ReturnType<ViewerAppContext["createTimelineBlock"]>
    >().toEqualTypeOf<HTMLButtonElement>();
    expectTypeOf<
      ReturnType<ViewerAppContext["getSceneOwnershipSummary"]>["rows"][number]
    >().toEqualTypeOf<[string, string]>();
    expectTypeOf<
      ReturnType<ViewerAppContext["createPhaseOptions"]>[number]["value"]
    >().toBeString();
    expectTypeOf<
      Parameters<ViewerAppContext["appendInspectorSelectRow"]>[0]["onChange"]
    >().toEqualTypeOf<(value: string) => void>();
  });

  it("keeps selection commands and navigation items typed at the application boundary", () => {
    expectTypeOf<
      ReturnType<ViewerAppContext["getVisibleTimelineSelectionItems"]>
    >().toEqualTypeOf<TimelineNavigationItem[]>();
    expectTypeOf<
      ReturnType<ViewerAppContext["isSelectedLayer"]>
    >().toBeBoolean();
    expectTypeOf<Parameters<ViewerAppContext["selectLayer"]>[0]>().toBeString();
    expectTypeOf<
      Parameters<ViewerAppContext["setSelectedKeyframes"]>[0]
    >().toBeUnknown();
  });

  it("keeps timeline action payloads typed at the application boundary", () => {
    expectTypeOf<
      ReturnType<ViewerAppContext["createClipMovePlan"]>
    >().toEqualTypeOf<ClipMovePlan>();
    expectTypeOf<
      ReturnType<ViewerAppContext["createPhaseMovePlan"]>
    >().toEqualTypeOf<PhaseMovePlan>();
    expectTypeOf<
      ReturnType<ViewerAppContext["createSceneMovePlan"]>
    >().toEqualTypeOf<SceneMovePlan>();
    expectTypeOf<
      ReturnType<ViewerAppContext["buildSelectedOwnershipLinks"]>
    >().toEqualTypeOf<OwnershipLinks>();
    expectTypeOf<
      ReturnType<ViewerAppContext["getSelectedTimelineRange"]>
    >().toEqualTypeOf<SelectedTimelineRange | null>();
    expectTypeOf<
      Parameters<ViewerAppContext["isTimeInsideRange"]>[0]
    >().toBeNumber();
    expectTypeOf<
      ClipMovePlan["keyframeItems"][number]["keyframe"]["value"]
    >().toBeUnknown();
  });

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
    expectTypeOf(
      state.timelineRenderSnapshot,
    ).toEqualTypeOf<TimelineRenderSnapshot | null>();
    expectTypeOf<
      ReturnType<ViewerAppContext["createTimelineRowTree"]>
    >().toEqualTypeOf<TimelineRowTree>();
    expectTypeOf<
      TimelineTrackRow["keyframes"][number]["value"]
    >().toBeUnknown();
    expectTypeOf(
      state.canvasTransformPreview,
    ).toEqualTypeOf<CanvasTransformPreview | null>();
    expectTypeOf(state.keyframeClipboard).toEqualTypeOf<
      KeyframeClipboardEntry[] | null
    >();
    expectTypeOf(state.lastBindingReads).toEqualTypeOf<RendererBindingReads>();
    expectTypeOf(
      state.rendererContractReads,
    ).toEqualTypeOf<RendererBindingReads>();
    expectTypeOf(
      state.lastRenderProfile,
    ).toEqualTypeOf<ViewerRenderProfile | null>();
    expectTypeOf(state.pending).toEqualTypeOf<
      Map<string, PendingSandboxRequest>
    >();
    expectTypeOf(state.mp4Export).toEqualTypeOf<Mp4ExportState>();
    expectTypeOf(state.previewAudio).toEqualTypeOf<PreviewAudioState>();
    expectTypeOf(
      state.previewVideoCache,
    ).toEqualTypeOf<PlaybackVideoCacheState>();
    expectTypeOf(
      state.renderTemplateSnapshot,
    ).toEqualTypeOf<RenderTemplateSnapshot | null>();
    expectTypeOf(
      state.queuedRenderOptions,
    ).toEqualTypeOf<RenderOptions | null>();
    expectTypeOf(state.renderIdleWaiters).toEqualTypeOf<(() => void)[]>();
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
