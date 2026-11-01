import type { EffectLayer } from "../src/sdk/types.js";
import { readEditorTemplateSource } from "../src/apps/viewer/templates/source.js";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer structural layer grouping", () => {
  it("groups and ungroups one contiguous selection with atomic commands", () => {
    const ctx = createContext();

    expect(ctx.groupSelectedLayers()).toBe(true);
    expect(requireTemplate(ctx).layers).toEqual([
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
    expect(requireTemplate(ctx).layers).toEqual([
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

    ctx.duplicateSelectedLayers();
    const duplicated = requireTemplate(ctx);
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
    expect(ctx.getEffectiveTimeline().tracks.map((track) => track.id)).toEqual([
      "card.x",
      "rect-1.x",
    ]);
    expect(ctx.state.selectedLayers).toEqual(["group-2"]);

    ctx.deleteSelectedLayers();
    expect(requireTemplate(ctx).layers.map((layer) => layer.id)).toEqual([
      "group-1",
      "card",
      "title",
    ]);
    expect(requireTemplate(ctx).clips.map((clip) => clip.layerId)).toEqual([
      "card",
      "title",
    ]);
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

    ctx.toggleLayerVisibility("group-1");
    expect(
      requireTemplate(ctx)
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
      requireTemplate(ctx)
        .layers.filter((layer) => layer.type !== "group")
        .map((layer) => layer.locked),
    ).toEqual([true, true]);
  });
});

function editableLayer(
  id: string,
  type: EffectLayer["type"],
  parentId: string | null,
): EffectLayer {
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

function createContext(patch: Record<string, unknown> = {}) {
  const ctx = createViewerContextFixture();
  ctx.state.currentTemplate = readEditorTemplateSource({
    clips: [],
    duration: 3,
    id: "template",
    layers: [
      editableLayer("card", "rect", null),
      editableLayer("title", "text", null),
    ],
    timeline: { phases: [], tracks: [] },
    ...patch,
  });
  ctx.state.selectedItem = { layerId: "title", type: "layer" };
  ctx.state.selectedLayers = ["card", "title"];
  const beginEditorCommand = vi
    .spyOn(ctx, "beginEditorCommand")
    .mockImplementation(() => {});
  for (const key of [
    "logDiagnostic",
    "renderAssetsPanel",
    "renderTimelineEditor",
    "updateCanvasSelectionBox",
  ] as const)
    vi.spyOn(ctx, key).mockImplementation(() => {});
  vi.spyOn(ctx, "renderCurrentFrame").mockResolvedValue(undefined);
  return Object.assign(ctx, { beginEditorCommand });
}

function requireTemplate(ctx: ReturnType<typeof createContext>) {
  const template = ctx.getEffectiveTemplate();
  if (!template) throw new Error("Missing fixture template");
  return template;
}
