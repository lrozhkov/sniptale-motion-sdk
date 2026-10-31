import { createCanvasDragPreview } from "../src/apps/viewer/canvas/drag-preview.js";
import { createPresetPanelActions } from "../src/apps/viewer/panels/presets.js";
import { normalizePresets } from "../src/apps/viewer/editor/model.js";
import { createStarterDocument } from "../src/apps/cli/starter.js";
import {
  normalizeEffectV1ToTemplate,
  validateEffectV1Document,
} from "../src/sdk/effect-v1/index.js";
import { createTemplateModelActions } from "../src/apps/viewer/templates/controller.js";
import { buildEffectFilePayload } from "../src/apps/viewer/effect-file/builder.js";
import { normalizeScenes } from "../src/apps/viewer/editor/model.js";
import { describe, expect, it, vi } from "vitest";

import {
  captureEditorSnapshot,
  commitEditorHistory,
  restoreEditorSnapshotState,
} from "../src/apps/viewer/editor/history";
import { deepClone } from "../src/apps/viewer/editor/model";
import { createEditorStoreActions } from "../src/apps/viewer/editor/store";
import { createEditorHistoryActions } from "../src/apps/viewer/editor/history-controller";

describe("viewer editor history transactions", () => {
  it("rejects non-numeric duration data without invoking conversion hooks", () => {
    const ctx = createStoreContext();
    Object.assign(
      ctx,
      createEditorStoreActions(() => ctx),
    );
    const calls: string[] = [];
    const foreign = {
      valueOf() {
        calls.push("duration");
        return 4;
      },
    };
    for (const duration of ["4", foreign, Infinity]) {
      ctx.setEditorOverride({ duration });
      expect(() => ctx.getEffectiveDuration()).toThrow(
        /Invalid editor template duration/,
      );
    }
    expect(calls).toEqual([]);
    expect(ctx.state.currentTemplate.duration).toBe(4);
  });

  for (const direction of ["undo", "redo"] as const) {
    it(`keeps ${direction} history consistent when presentation fails after restoration`, async () => {
      const ctx = createHistoryTransitionContext();
      ctx.state.controls = { value: "target" };
      const target = ctx.captureEditorSnapshot("target");
      ctx.state.controls = { value: "current" };
      const sourceStack =
        direction === "undo" ? "historyPast" : "historyFuture";
      const destinationStack =
        direction === "undo" ? "historyFuture" : "historyPast";
      ctx.state[sourceStack] = [target];
      ctx.renderCurrentFrame = vi.fn(async () => {
        throw new Error("presentation failed");
      });
      await expect(
        direction === "undo" ? ctx.undoEditorEdit() : ctx.redoEditorEdit(),
      ).rejects.toThrow("presentation failed");
      expect(ctx.state.controls).toEqual({ value: "target" });
      expect(ctx.state[sourceStack]).toEqual([]);
      expect(ctx.state[destinationStack]).toHaveLength(1);
      expect(ctx.state[destinationStack][0].controls).toEqual({
        value: "current",
      });
      expect(ctx.state.editorHistoryBusy).toBe(false);
      expect(ctx.markEditorChanged).toHaveBeenCalledWith(direction, {
        immediate: true,
      });
    });

    it(`rejects an invalid ${direction} snapshot without consuming history`, async () => {
      const ctx = createHistoryTransitionContext();
      const target = ctx.captureEditorSnapshot("invalid");
      target.assetEntries = [["image", { id: "other" }]];
      const sourceStack =
        direction === "undo" ? "historyPast" : "historyFuture";
      const destinationStack =
        direction === "undo" ? "historyFuture" : "historyPast";
      ctx.state[sourceStack] = [target];
      expect(
        await (direction === "undo"
          ? ctx.undoEditorEdit()
          : ctx.redoEditorEdit()),
      ).toBe(false);
      expect(ctx.state[sourceStack]).toEqual([target]);
      expect(ctx.state[destinationStack]).toEqual([]);
      expect(ctx.renderCurrentFrame).not.toHaveBeenCalled();
      expect(ctx.state.editorHistoryBusy).toBe(false);
    });
  }

  it("commits history before presentation and does not write to a replacement template after await", async () => {
    const ctx = createHistoryTransitionContext();
    ctx.state.historyPast = [ctx.captureEditorSnapshot("target")];
    const rendered = Promise.withResolvers<void>();
    ctx.renderCurrentFrame = vi.fn(() => rendered.promise);
    const pending = ctx.undoEditorEdit();
    expect(ctx.state.historyFuture).toHaveLength(1);
    expect(ctx.state.editorHistoryBusy).toBe(true);
    expect(await ctx.redoEditorEdit()).toBe(false);
    ctx.state.currentTemplate = {
      ...ctx.state.currentTemplate,
      id: "replacement",
    };
    ctx.state.historyPast = [];
    ctx.state.historyFuture = [];
    rendered.resolve();
    expect(await pending).toBe(true);
    expect(ctx.state.historyPast).toEqual([]);
    expect(ctx.state.historyFuture).toEqual([]);
  });

  it("keeps source identity when refreshing timeline and health surfaces", () => {
    const ctx = createStoreContext();
    const source = ctx.state.currentTemplate;
    source.timeline = { phases: [], tracks: [] };
    ctx.state.timelineFullEditorRenderCount = 0;
    Object.assign(ctx.refs, {
      timelineTracks: { scrollLeft: 12, scrollTop: 34 },
      durationInput: { value: "" },
    });
    for (const name of [
      "reconcileTimelineSelection",
      "renderLayersPanel",
      "renderAssetsPanel",
      "renderPresetsPanel",
      "updateTemplateContext",
      "renderTimelineRuler",
      "renderTimelineTracks",
      "renderCurveEditor",
      "renderSelectionCrumb",
      "updateTimelinePlayhead",
      "renderInspector",
      "renderValidationPanel",
      "renderRendererBindingsPanel",
      "updateCanvasSelectionBox",
      "updateExportAvailability",
    ])
      ctx[name] = vi.fn();
    ctx.getEffectiveTemplate = vi.fn(() => ({ ...source }));
    Object.assign(
      ctx,
      createEditorStoreActions(() => ctx),
    );
    ctx.renderTimelineEditor(source);
    expect(ctx.renderTimelineTracks.mock.calls[0]?.[0]).toBe(source);
    expect(ctx.renderValidationPanel.mock.calls[0]?.[0]).toBe(source);
    expect(ctx.renderRendererBindingsPanel.mock.calls[0]?.[0]).toBe(source);
    expect(ctx.getEffectiveTemplate).not.toHaveBeenCalled();
    expect(ctx.refs.timelineTracks).toMatchObject({
      scrollLeft: 12,
      scrollTop: 34,
    });
  });

  it("coalesces repeated keyboard edits without merging unrelated actions", () => {
    const ctx = createStoreContext();
    Object.assign(
      ctx,
      createEditorStoreActions(() => ctx),
    );
    Object.assign(
      ctx,
      createEditorHistoryActions(() => ctx),
    );

    ctx.commitHistory("nudge-layer:box", {
      coalesceKey: "nudge-layer:box",
    });
    ctx.state.editorOverrides.set("template", { layers: [{ x: 1 }] });
    ctx.commitHistory("nudge-layer:box", {
      coalesceKey: "nudge-layer:box",
    });
    ctx.state.editorOverrides.set("template", { layers: [{ x: 2 }] });
    ctx.commitHistory("duration");

    expect(ctx.state.historyPast).toHaveLength(2);
    expect(ctx.state.historyPast[0].editorOverride).toBeNull();
    expect(ctx.state.historyPast[1].editorOverride).toEqual({
      layers: [{ x: 2 }],
    });
    expect(ctx.markEditorChanged).toHaveBeenCalledTimes(3);
  });

  it("validates opaque overrides without changing source or accepting a partial write", () => {
    const ctx = createStoreContext();
    Object.assign(
      ctx,
      createEditorStoreActions(() => ctx),
    );
    expect(ctx.getEffectiveDuration()).toBe(4);
    ctx.setEditorOverride({ duration: 0.02, extension: { keep: true } });
    expect(ctx.getEffectiveDuration()).toBe(0.02);
    expect(ctx.getEditorOverride()).toEqual({
      duration: 0.02,
      extension: { keep: true },
    });
    expect(() => ctx.setEditorOverride(["invalid"])).toThrow(
      /Invalid editor template override/,
    );
    expect(ctx.getEditorOverride()).toEqual({
      duration: 0.02,
      extension: { keep: true },
    });
    expect(ctx.state.currentTemplate.duration).toBe(4);
    ctx.state.editorOverrides.set("template", "corrupt");
    expect(() => ctx.getEditorOverride()).toThrow(
      /Invalid editor template override/,
    );
  });

  it("opens and exports a short localized scene without retiming or replacing its labels", () => {
    const document = createStarterDocument("tiny-scene", "standalone");
    document.duration = 0.02;
    document.clips = document.clips.map((clip) => ({
      ...clip,
      start: 0.001,
      duration: 0.019,
    }));
    document.scenes = [
      {
        id: "main",
        start: 0.001,
        duration: 0.019,
        label: { en: "Intro", ru: "Вступление" },
      },
    ];
    expect(validateEffectV1Document(document).ok).toBe(true);
    const ctx = createStoreContext();
    const template = normalizeEffectV1ToTemplate(document);
    ctx.state.currentTemplate = template;
    Object.assign(
      ctx,
      createEditorStoreActions(() => ctx),
    );
    Object.assign(
      ctx,
      createTemplateModelActions(() => ctx),
    );
    const effective = ctx.getEffectiveTemplate();
    expect(effective.scenes).toEqual(document.scenes);
    expect(template.scenes).toEqual(document.scenes);
    const viewScenes = normalizeScenes(effective.scenes, effective.duration);
    expect(viewScenes[0]?.start).toBe(0.001);
    expect(viewScenes[0]?.duration).toBe(0.019);
    expect(typeof viewScenes[0]?.label).toBe("string");
    const exported = buildEffectFilePayload({
      template: effective,
      assets: new Map(),
    });
    expect(exported.scenes).toEqual(document.scenes);
    expect(validateEffectV1Document(exported).diagnostics).toEqual([]);
  });

  it("captures, applies and exports precise preset data and rejects malformed data before mutation", async () => {
    const document = createStarterDocument("preset-roundtrip", "standalone");
    const ctx = createStoreContext();
    ctx.state.currentTemplate = normalizeEffectV1ToTemplate(document);
    Object.assign(ctx.deps, {
      normalizePresets,
      t: (_key: string, fallback: string) => fallback,
      translateText: (_label: unknown, fallback: string) => fallback,
    });
    Object.assign(
      ctx,
      createEditorStoreActions(() => ctx),
    );
    Object.assign(
      ctx,
      createTemplateModelActions(() => ctx),
    );
    Object.assign(
      ctx,
      createPresetPanelActions(() => ctx),
    );
    ctx.applyEditorCommand = vi.fn((_command: unknown, mutate: () => void) =>
      mutate(),
    );
    for (const name of [
      "clearTimelineSelection",
      "logDiagnostic",
      "renderControls",
      "renderTimelineEditor",
      "renderCurrentFrame",
    ])
      ctx[name] = vi.fn();
    ctx.formatSeconds = String;
    ctx.toTitleLabel = String;
    Object.assign(ctx.refs, {
      durationInput: { value: "" },
      timeOutput: { textContent: "" },
      timelineSaveStatus: { textContent: "" },
    });
    const source = ctx.getEffectiveTemplate();
    const preset = ctx.createPresetFromTemplate(source, "precise");
    preset.duration = 0.02;
    preset.clips = preset.clips.map((clip: Record<string, unknown>) => ({
      ...clip,
      start: 0.001,
      duration: 0.019,
    }));
    preset.scenes = [
      {
        id: "main",
        start: 0.001,
        duration: 0.019,
        label: { ru: "Вступление", en: "Intro" },
      },
    ];
    preset.timeline = { phases: [], tracks: [] };
    preset.extension = { retained: true };
    const before = structuredClone(preset);
    ctx.setPresets([preset]);
    expect(await ctx.applyPreset("precise")).toBe(true);
    const effective = ctx.getEffectiveTemplate();
    expect(effective.duration).toBe(0.02);
    expect(effective.scenes).toEqual(before.scenes);
    expect(effective.timeline).toEqual({ ...before.timeline, duration: 0.02 });
    const captured = ctx.createPresetFromTemplate(effective, "recaptured");
    expect(captured.scenes).toEqual(before.scenes);
    const exported = buildEffectFilePayload({
      template: effective,
      assets: new Map(),
    });
    expect(exported.presets).toEqual([before]);
    expect(validateEffectV1Document(exported).diagnostics).toEqual([]);
    expect(preset).toEqual(before);
    for (const patch of [
      { scenes: [{ id: "broken" }] },
      { timeline: { tracks: [null] } },
      { duration: 0 },
      { duration: "0.02" },
    ]) {
      ctx.setPresets([{ ...before, ...patch }]);
      const override = structuredClone(ctx.getEditorOverride());
      const timeline = structuredClone(
        ctx.state.timelineOverrides.get(document.id),
      );
      const calls = ctx.applyEditorCommand.mock.calls.length;
      await expect(ctx.applyPreset("precise")).rejects.toThrow(/Invalid/);
      expect(ctx.getEditorOverride()).toEqual(override);
      expect(ctx.state.timelineOverrides.get(document.id)).toEqual(timeline);
      expect(ctx.applyEditorCommand).toHaveBeenCalledTimes(calls);
    }
  });

  it("invalidates an active canvas operation when restoring a snapshot", () => {
    const ctx = createStoreContext();
    ctx.refs.canvasSelectionBox = { dataset: {} };
    ctx.renderCurrentFrame = vi.fn(async () => undefined);
    Object.assign(
      ctx,
      createEditorStoreActions(() => ctx),
    );
    Object.assign(
      ctx,
      createEditorHistoryActions(() => ctx),
    );
    const snapshot = ctx.captureEditorSnapshot("before");
    const preview = createCanvasDragPreview(ctx);
    expect(preview.isCurrent()).toBe(true);
    expect(ctx.restoreEditorSnapshotData(snapshot)).toBe(true);
    expect(preview.isCurrent()).toBe(false);
    expect(ctx.state.canvasTransformDragActive).toBe(false);
    expect(ctx.refs.canvasSelectionBox.dataset.transforming).toBeUndefined();
    preview.finalize();
  });

  it("stores only asset deltas and restores the loaded base asset", () => {
    const ctx = createStoreContext();
    const baseAsset = { id: "image", path: "base.png" };
    const replacement = { id: "image", path: "replacement.png" };
    ctx.state.currentTemplate.assets = ["image"];
    ctx.state.assets.set("image", baseAsset);
    ctx.state.baseAssets.set("image", baseAsset);
    Object.assign(
      ctx,
      createEditorStoreActions(() => ctx),
    );
    Object.assign(
      ctx,
      createEditorHistoryActions(() => ctx),
    );

    const baseSnapshot = ctx.captureEditorSnapshot("base");
    expect(baseSnapshot.assetEntries).toEqual([]);

    ctx.state.assets.set("image", replacement);
    const replacementSnapshot = ctx.captureEditorSnapshot("replacement");
    expect(replacementSnapshot.assetEntries).toEqual([["image", replacement]]);

    expect(ctx.restoreEditorSnapshotData(baseSnapshot)).toBe(true);
    expect(ctx.state.assets.get("image")).toBe(baseAsset);
    expect(ctx.restoreEditorSnapshotData(replacementSnapshot)).toBe(true);
    expect(ctx.state.assets.get("image")).toBe(replacement);
  });

  it("rejects malformed asset history before changing editor state", () => {
    const ctx = createStoreContext();
    Object.assign(
      ctx,
      createEditorStoreActions(() => ctx),
    );
    Object.assign(
      ctx,
      createEditorHistoryActions(() => ctx),
    );
    const snapshot = ctx.captureEditorSnapshot("invalid assets");
    snapshot.assetEntries = [["image", { id: "image", blob: {} }]];
    const override = ctx.state.editorOverrides.get("template");
    const assets = new Map(ctx.state.assets);
    expect(ctx.restoreEditorSnapshotData(snapshot)).toBe(false);
    expect(ctx.state.editorOverrides.get("template")).toBe(override);
    expect(ctx.state.assets).toEqual(assets);
  });

  it("restores structural groups and canonical multi-selection together", () => {
    const ctx = createStoreContext();
    Object.assign(
      ctx,
      createEditorStoreActions(() => ctx),
    );
    Object.assign(
      ctx,
      createEditorHistoryActions(() => ctx),
    );
    ctx.state.editorOverrides.set("template", {
      layers: [
        { id: "group-1", type: "group" },
        { id: "card", parentId: "group-1", type: "rect" },
        { id: "title", parentId: "group-1", type: "text" },
      ],
    });
    ctx.state.selectedLayers = ["group-1"];
    ctx.state.selectedItem = { layerId: "group-1", type: "layer" };
    const snapshot = ctx.captureEditorSnapshot("grouped");

    ctx.state.editorOverrides.set("template", {
      layers: [
        { id: "card", type: "rect" },
        { id: "title", type: "text" },
      ],
    });
    ctx.state.selectedLayers = ["card", "title"];
    ctx.state.selectedItem = { layerId: "title", type: "layer" };

    expect(ctx.restoreEditorSnapshotData(snapshot)).toBe(true);
    expect(ctx.state.editorOverrides.get("template").layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "group-1", type: "group" }),
        expect.objectContaining({ id: "card", parentId: "group-1" }),
        expect.objectContaining({ id: "title", parentId: "group-1" }),
      ]),
    );
    expect(ctx.state.selectedLayers).toEqual(["group-1"]);
    expect(ctx.state.selectedItem).toEqual({
      layerId: "group-1",
      type: "layer",
    });
  });
});

function createStoreContext(): any {
  const template = { assets: [], duration: 4, id: "template", layers: [] };
  const state: any = {
    assets: new Map(),
    baseAssets: new Map(),
    controls: {},
    currentTemplate: template,
    editorCommands: [],
    editorOverrides: new Map(),
    historyCoalescing: null,
    historyFuture: [],
    historyPast: [],
    selectedClips: [],
    selectedItem: { type: "effect" },
    selectedKeyframes: [],
    selectedLayers: [],
    selectedPhases: [],
    selectedPresetId: null,
    selectedScenes: [],
    timelineOverrides: new Map(),
  };
  return {
    deps: {
      buildControlsWithDefaults: () => ({}),
      captureEditorSnapshotState: captureEditorSnapshot,
      clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
      commitEditorHistory,
      deepClone,
      recordEditorCommandState: vi.fn(),
      restoreEditorSnapshotState,
      normalizeTimeline: (timeline) => timeline,
    },
    getEffectiveTemplate: () => ({
      ...template,
      ...(state.editorOverrides.get("template") ?? {}),
    }),
    markEditorChanged: vi.fn(),
    refs: {
      timeSlider: { value: "0" },
    },
    state,
    syncEditorWorkflowUi: vi.fn(),
  };
}

function createHistoryTransitionContext() {
  const ctx = createStoreContext();
  Object.assign(
    ctx,
    createEditorStoreActions(() => ctx),
    createEditorHistoryActions(() => ctx),
  );
  ctx.formatSeconds = String;
  ctx.refs.timeOutput = { textContent: "" };
  ctx.renderTimelineEditor = vi.fn();
  ctx.renderControls = vi.fn();
  ctx.renderCurrentFrame = vi.fn(async () => undefined);
  return ctx;
}
