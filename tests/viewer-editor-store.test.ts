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
