import { createStarterDocument } from "../src/apps/cli/starter.js";
import {
  normalizeEffectV1ToTemplate,
  validateEffectV1Document,
} from "../src/sdk/effect-v1/index.js";
import { installTemplatesControllerOwner } from "../src/apps/viewer/templates/controller.js";
import { buildEffectFilePayload } from "../src/apps/viewer/effect-file/builder.js";
import { normalizeScenes } from "../src/apps/viewer/editor/model.js";
import { describe, expect, it, vi } from "vitest";

import {
  captureEditorSnapshot,
  commitEditorHistory,
  restoreEditorSnapshotState,
} from "../src/apps/viewer/editor/history";
import { deepClone } from "../src/apps/viewer/editor/model";
import { installEditorStoreOwner } from "../src/apps/viewer/editor/store";
import { installEditorHistoryControllerOwner } from "../src/apps/viewer/editor/history-controller";

describe("viewer editor history transactions", () => {
  it("coalesces repeated keyboard edits without merging unrelated actions", () => {
    const ctx = createStoreContext();
    installEditorStoreOwner(ctx);
    installEditorHistoryControllerOwner(ctx);

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
    installEditorStoreOwner(ctx);
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
    installEditorStoreOwner(ctx);
    installTemplatesControllerOwner(ctx);
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
    expect(validateEffectV1Document(exported).ok).toBe(true);
  });

  it("stores only asset deltas and restores the loaded base asset", () => {
    const ctx = createStoreContext();
    const baseAsset = { id: "image", path: "base.png" };
    const replacement = { id: "image", path: "replacement.png" };
    ctx.state.currentTemplate.assets = ["image"];
    ctx.state.assets.set("image", baseAsset);
    ctx.state.baseAssets.set("image", baseAsset);
    installEditorStoreOwner(ctx);
    installEditorHistoryControllerOwner(ctx);

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

  it("restores structural groups and canonical multi-selection together", () => {
    const ctx = createStoreContext();
    installEditorStoreOwner(ctx);
    installEditorHistoryControllerOwner(ctx);
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
