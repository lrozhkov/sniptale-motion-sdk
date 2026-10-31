import { readEditorTemplateSource } from "../src/apps/viewer/templates/source.js";
import type { TimelineSearchIndexContext } from "../src/apps/viewer/timeline/navigation/search-model.js";
import type { TimelineLayerSearchResult } from "../src/apps/viewer/timeline/navigation/contract.js";
import { describe, expect, it, vi } from "vitest";
import { revealTimelineLayer } from "../src/apps/viewer/timeline/navigation/reveal";
import {
  getTimelineLayerSearchResults,
  getCachedTimelineLayerSearchIndex,
  normalizeTimelineLayerSearch,
} from "../src/apps/viewer/timeline/navigation/search-model";

describe("timeline layer navigation", () => {
  it("refreshes cached results after editing and reuses them only for the same source inputs", () => {
    const source = readEditorTemplateSource({ id: "source", duration: 1 });
    let name = "Original";
    let locale = "ru";
    const build = vi.fn<
      (template: { id: string } | null) => TimelineLayerSearchResult[]
    >((template) =>
      template
        ? [
            {
              depth: 0,
              expansionIds: [],
              globalScope: true,
              hidden: false,
              key: "global:card",
              layerId: "card",
              locked: false,
              name,
              path: [name],
              sceneId: null,
              sceneLabel: "Global",
              typeLabel: "Rectangle",
            },
          ]
        : [],
    );
    const editorOverrides = new Map<string, unknown>();
    const timelineOverrides = new Map<string, unknown>();
    const ctx: TimelineSearchIndexContext = {
      state: { currentTemplate: source, editorOverrides, timelineOverrides },
      deps: { getLocale: () => locale },
      timelineLayerSearchIndexCache: null,
      createTimelineLayerSearchIndex: build,
    };
    const initial = getCachedTimelineLayerSearchIndex(ctx);
    expect(getCachedTimelineLayerSearchIndex(ctx)).toBe(initial);
    expect(build).toHaveBeenCalledOnce();
    name = "Renamed";
    editorOverrides.set(source.id, { label: name });
    const renamed = getCachedTimelineLayerSearchIndex(ctx);
    expect(renamed[0]?.name).toBe("Renamed");
    expect(renamed).not.toBe(initial);
    expect(getCachedTimelineLayerSearchIndex(ctx)).toBe(renamed);
    timelineOverrides.set(source.id, { tracks: [] });
    expect(getCachedTimelineLayerSearchIndex(ctx)).not.toBe(renamed);
    locale = "en";
    const localized = getCachedTimelineLayerSearchIndex(ctx);
    ctx.state.currentTemplate = { ...source };
    expect(getCachedTimelineLayerSearchIndex(ctx)).not.toBe(localized);
    ctx.state.currentTemplate = null;
    expect(getCachedTimelineLayerSearchIndex(ctx)).toEqual([]);
    expect(build).toHaveBeenCalledTimes(6);
  });

  it("searches translated names, ids, types, and nested group paths", () => {
    const ctx = createSearchContext();

    expect(normalizeTimelineLayerSearch("  RévéAL / Карточка  ")).toBe(
      "reveal карточка",
    );
    expect(
      getTimelineLayerSearchResults(
        ctx,
        ctx.state.currentTemplate,
        "compose card",
      ).map((result) => result.key),
    ).toEqual(["main:card-layer", "outro:card-layer"]);
    expect(
      getTimelineLayerSearchResults(
        ctx,
        ctx.state.currentTemplate,
        "rectangle",
      ).map((result) => result.layerId),
    ).toEqual(["card-layer", "card-layer"]);
    expect(
      getTimelineLayerSearchResults(
        ctx,
        ctx.state.currentTemplate,
        "card-layer",
      ).map((result) => result.layerId),
    ).toEqual(["card-layer", "card-layer"]);
  });

  it("keeps scene occurrences distinct and carries the reveal ancestry", () => {
    const ctx = createSearchContext();
    const results = getTimelineLayerSearchResults(
      ctx,
      ctx.state.currentTemplate,
      "card",
    );

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.sceneId)).toEqual(["main", "outro"]);
    expect(results[0]).toMatchObject({
      expansionIds: ["main:compose"],
      layerId: "card-layer",
      path: ["Compose", "Card"],
    });
  });

  it("reveals only the required scene and ancestor rows before selection", () => {
    const ctx = createRevealContext();
    const requestAnimationFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);

    expect(
      revealTimelineLayer(ctx, {
        depth: 2,
        expansionIds: ["main:compose", "main:visual"],
        globalScope: false,
        hidden: false,
        key: "main:card",
        layerId: "card",
        locked: false,
        name: "Card",
        path: ["Compose", "Visual", "Card"],
        sceneId: "main",
        sceneLabel: "Main",
        typeLabel: "Rectangle",
      }),
    ).toBe(true);

    expect(ctx.state.expandedSceneIds).toEqual(new Set(["main"]));
    expect(ctx.setTimelineRowExpanded.mock.calls).toEqual([
      ["scene", "main", true],
      ["group", "main:compose", true],
      ["group", "main:visual", true],
    ]);
    expect(ctx.selectCanvasLayers).toHaveBeenCalledWith(["card"], "card", {
      sync: false,
    });
    expect(ctx.renderTimelineStructure).toHaveBeenCalledWith(
      ctx.state.currentTemplate,
    );
    expect(ctx.syncTimelineSelection).toHaveBeenCalledWith(
      ctx.state.currentTemplate,
    );
    expect(ctx.scrollTimelineRowIntoView).toHaveBeenCalledWith(7);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

function createSearchContext(): any {
  const card = {
    id: "card-layer",
    name: { en: "Card", ru: "Карточка" },
    type: "rect",
  };
  const compose = { id: "compose", name: "Compose", type: "group" };
  const template = {
    id: "fixture",
    layers: [compose, card],
  };
  const createRows = (sceneId) => [
    {
      children: [
        {
          depth: 2,
          expansionId: `${sceneId}:card-layer`,
          kind: "layer",
          layer: card,
          layerId: "card-layer",
        },
      ],
      depth: 1,
      expansionId: `${sceneId}:compose`,
      kind: "group",
      layer: compose,
      layerId: "compose",
    },
  ];
  return {
    createTimelineRowTree: () => ({
      globalLayers: [],
      scenes: [
        {
          layers: createRows("main"),
          scene: { id: "main", label: "Main" },
        },
        {
          layers: createRows("outro"),
          scene: { id: "outro", label: "Outro" },
        },
      ],
    }),
    deps: {
      getLocale: () => "en",
      t: (key, fallback) =>
        key === "viewer.timeline.layerTypes.rect" ? "Rectangle" : fallback,
      translateText: (value, fallback) =>
        typeof value === "object" ? value.en : value || fallback,
    },
    getEffectiveTemplate: () => template,
    state: { currentTemplate: template },
  };
}

function createRevealContext(): any {
  const currentTemplate = { id: "fixture" };
  return {
    getEffectiveTemplate: () => ({
      layers: [{ id: "card", type: "rect" }],
    }),
    getTimelineLayerRowIndex: vi.fn(() => 7),
    renderTimelineStructure: vi.fn(),
    selectCanvasLayers: vi.fn(),
    setTimelineRowExpanded: vi.fn(),
    scrollTimelineRowIntoView: vi.fn(),
    syncTimelineSelection: vi.fn(),
    state: {
      currentTemplate,
      expandedSceneIds: new Set(),
    },
  };
}
