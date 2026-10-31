import { describe, expect, it, vi } from "vitest";

import { installLayersClipboardOwner } from "../src/apps/viewer/layers/clipboard";
import { createLayerEditorCapabilityActions } from "../src/apps/viewer/layers/editor-capabilities";
import { installLayersFactoryOwner } from "../src/apps/viewer/layers/factory";
import { installLayersGroupingOwner } from "../src/apps/viewer/layers/grouping";
import { createLayerHierarchyActions } from "../src/apps/viewer/layers/hierarchy-controller";
import { installLayersPropertiesOwner } from "../src/apps/viewer/layers/properties";

describe("viewer structural layer grouping", () => {
  it("groups and ungroups one contiguous selection with atomic commands", () => {
    const ctx = createContext();
    Object.assign(
      ctx,
      createLayerHierarchyActions(() => ctx),
    );
    installLayersGroupingOwner(ctx);

    expect(ctx.groupSelectedLayers()).toBe(true);
    expect(ctx.getEffectiveTemplate().layers).toEqual([
      expect.objectContaining({ id: "group-1", type: "group" }),
      expect.objectContaining({ id: "card", parentId: "group-1" }),
      expect.objectContaining({ id: "title", parentId: "group-1" }),
    ]);
    expect(ctx.state.selectedLayers).toEqual(["group-1"]);
    expect(ctx.beginEditorCommand).toHaveBeenLastCalledWith({
      payload: { groupId: "group-1", layerIds: ["card", "title"] },
      type: "groupLayers",
    });

    expect(ctx.ungroupSelectedLayers()).toBe(true);
    expect(ctx.getEffectiveTemplate().layers).toEqual([
      expect.objectContaining({ id: "card", parentId: null }),
      expect.objectContaining({ id: "title", parentId: null }),
    ]);
    expect(ctx.state.selectedLayers).toEqual(["card", "title"]);
    expect(ctx.beginEditorCommand).toHaveBeenLastCalledWith({
      payload: { groupIds: ["group-1"] },
      type: "ungroupLayers",
    });
  });

  it("duplicates and deletes complete group subtrees with owned timing", () => {
    const ctx = createContext({
      clips: [
        { duration: 3, layerId: "card", start: 0 },
        { duration: 3, layerId: "title", start: 0 },
      ],
      layers: [
        { id: "group-1", name: "Content", parentId: null, type: "group" },
        editableLayer("card", "rect", "group-1"),
        editableLayer("title", "text", "group-1"),
      ],
      timeline: {
        phases: [],
        tracks: [
          {
            id: "card.x",
            keyframes: [{ id: "card-x-a", time: 0, value: 0 }],
            layerId: "card",
            property: "x",
            target: "card",
          },
        ],
      },
    });
    ctx.state.selectedLayers = ["group-1"];
    ctx.state.selectedItem = { layerId: "group-1", type: "layer" };
    Object.assign(
      ctx,
      createLayerHierarchyActions(() => ctx),
    );
    Object.assign(ctx, createLayerEditorCapabilityActions());
    installLayersFactoryOwner(ctx);
    installLayersClipboardOwner(ctx);

    ctx.duplicateSelectedLayers();
    const duplicated = ctx.getEffectiveTemplate();
    expect(duplicated.layers.map((layer) => layer.id)).toEqual([
      "group-1",
      "card",
      "title",
      "group-2",
      "rect-1",
      "text-1",
    ]);
    expect(duplicated.layers.find((layer) => layer.id === "rect-1")).toEqual(
      expect.objectContaining({ parentId: "group-2", x: 36, y: 36 }),
    );
    expect(duplicated.clips.map((clip) => clip.layerId)).toEqual([
      "card",
      "title",
      "rect-1",
      "text-1",
    ]);
    expect(
      ctx.state.timelineOverrides
        .get("template")
        .tracks.map((track) => track.id),
    ).toEqual(["card.x", "rect-1.x"]);
    expect(ctx.state.selectedLayers).toEqual(["group-2"]);

    ctx.deleteSelectedLayers();
    expect(ctx.getEffectiveTemplate().layers.map((layer) => layer.id)).toEqual([
      "group-1",
      "card",
      "title",
    ]);
    expect(
      ctx.getEffectiveTemplate().clips.map((clip) => clip.layerId),
    ).toEqual(["card", "title"]);
    expect(ctx.beginEditorCommand).toHaveBeenLastCalledWith({
      payload: { layerIds: ["group-2"] },
      type: "deleteLayers",
    });
  });

  it("toggles group visibility and lock atomically on every leaf", () => {
    const ctx = createContext({
      layers: [
        { id: "group-1", name: "Content", parentId: null, type: "group" },
        { ...editableLayer("card", "rect", "group-1"), locked: true },
        editableLayer("title", "text", "group-1"),
      ],
    });
    Object.assign(
      ctx,
      createLayerHierarchyActions(() => ctx),
    );
    installLayersPropertiesOwner(ctx);

    ctx.toggleLayerVisibility("group-1");
    expect(
      ctx
        .getEffectiveTemplate()
        .layers.filter((layer) => layer.type !== "group")
        .map((layer) => layer.visible),
    ).toEqual([false, false]);
    expect(ctx.beginEditorCommand).toHaveBeenLastCalledWith({
      payload: {
        layerIds: ["card", "title"],
        property: "visible",
        value: false,
      },
      type: "updateLayerProperty",
    });

    ctx.toggleLayerLock("group-1");
    expect(
      ctx
        .getEffectiveTemplate()
        .layers.filter((layer) => layer.type !== "group")
        .map((layer) => layer.locked),
    ).toEqual([true, true]);
  });
});

function editableLayer(id: string, type: string, parentId: string | null) {
  return {
    editor: {
      operations: ["delete", "duplicate", "reorder"],
    },
    id,
    name: id,
    parentId,
    type,
    x: 0,
    y: 0,
  };
}

function createContext(patch: Record<string, any> = {}): any {
  const template = {
    clips: [],
    duration: 3,
    id: "template",
    layers: [
      editableLayer("card", "rect", null),
      editableLayer("title", "text", null),
    ],
    timeline: { phases: [], tracks: [] },
    ...patch,
  };
  const ctx: any = {
    beginEditorCommand: vi.fn(),
    clearTimelineSelection: vi.fn(() => {
      ctx.state.selectedLayers = [];
      ctx.state.selectedItem = { type: "effect" };
    }),
    deps: {
      deepClone: structuredClone,
      normalizeTimeline: (value) => value,
      t: (_key, fallback) => fallback,
    },
    getEffectiveDuration: () => template.duration,
    getEffectiveTemplate: () => ({
      ...structuredClone(template),
      ...structuredClone(ctx.override),
      clips: structuredClone(ctx.override.clips ?? template.clips),
      layers: structuredClone(ctx.override.layers ?? template.layers),
      timeline: ctx.getEffectiveTimeline(),
    }),
    getEffectiveTimeline: () =>
      structuredClone(
        ctx.state.timelineOverrides.get(template.id) ?? template.timeline,
      ),
    logDiagnostic: vi.fn(),
    override: {},
    renderAssetsPanel: vi.fn(),
    renderCurrentFrame: vi.fn(),
    renderTimelineEditor: vi.fn(),
    sanitizeIdentifier: (value) => String(value),
    setEditorOverride: vi.fn((value) => {
      ctx.override = { ...ctx.override, ...value };
    }),
    state: {
      currentTemplate: template,
      selectedItem: { layerId: "title", type: "layer" },
      selectedLayers: ["card", "title"],
      timelineOverrides: new Map(),
    },
  };
  return ctx;
}
