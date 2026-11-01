import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { requiredEntry } from "./helpers/required-entry.js";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer timeline ownership predicates", () => {
  it("keeps a composition-end keyframe in the final timeline scope", () => {
    const template = { duration: 8 };
    const ctx = createViewerContextFixture();
    ctx.state.currentTemplate = { id: "fixture", ...template };
    vi.spyOn(ctx, "getKeyframeOwnershipSceneId").mockReturnValue(null);

    const track = { id: "background.opacity", keyframes: [] };
    const keyframe = { id: "background-end", time: 8, value: 1 };
    const intro = { duration: 4, id: "intro", start: 0 };
    const outro = { duration: 4, id: "outro", start: 4 };
    const global = {
      duration: 8,
      id: "__global__",
      isGlobalTimelineScope: true,
      start: 0,
    };

    expect(ctx.keyframeBelongsToScene(track, keyframe, intro)).toBe(false);
    expect(ctx.keyframeBelongsToScene(track, keyframe, outro)).toBe(true);
    expect(ctx.keyframeBelongsToScene(track, keyframe, global)).toBe(true);
  });

  it("keeps global rows in keyboard navigation without a fake scene owner", () => {
    const ctx = createViewerContextFixture();
    vi.spyOn(ctx, "createTimelineRowTree").mockReturnValue({
      globalScene: null,
      globalLayers: [
        {
          kind: "layer",
          layer: null,
          clip: { layerId: "background", start: 0, duration: 8 },
          directTracks: [],
          expansionId: "__global__:background",
          layerId: "background",
          phases: [],
        },
      ],
      scenes: [
        {
          layers: [],
          scene: { id: "intro", start: 0, duration: 4 },
          scenePhases: [],
          sceneTracks: [],
        },
      ],
    });
    vi.spyOn(ctx, "isSceneExpanded").mockReturnValue(false);
    vi.spyOn(ctx, "isTimelineRowExpanded").mockReturnValue(false);

    expect(ctx.getVisibleTimelineSelectionItems(requireTemplate(ctx))).toEqual([
      { layerId: "background", sceneId: null, type: "layer" },
      { layerId: "background", sceneId: null, type: "clip" },
      { sceneId: "intro", type: "scene" },
    ]);
    expect(ctx.getInspectorFocusTabForSelection({ type: "keyframe" })).toBe(
      "timing",
    );
  });

  it("separates a cross-scene unscoped clip into the global timeline scope", () => {
    const ctx = createViewerContextFixture();
    vi.spyOn(ctx, "getKeyframeOwnershipSceneId").mockReturnValue(null);
    vi.spyOn(ctx, "getTrackKeyframesForParent").mockReturnValue([]);

    const tree = ctx.createTimelineRowTree({
      id: "fixture",
      clips: [
        { duration: 8, layerId: "background", sceneId: null, start: 0 },
        { duration: 2, layerId: "title", sceneId: null, start: 1 },
      ],
      duration: 8,
      layers: [
        { id: "background", type: "rect" },
        { id: "title", type: "text" },
      ],
      scenes: [
        { duration: 4, id: "intro", start: 0 },
        { duration: 4, id: "outro", start: 4 },
      ],
      timeline: { phases: [], tracks: [] },
    });

    expect(tree.globalLayers.map((row) => row.layerId)).toEqual(["background"]);
    expect(
      tree.scenes.flatMap((scene) =>
        scene.layers.map((row) => `${scene.scene.id}:${row.layerId}`),
      ),
    ).toEqual(["intro:title"]);
  });

  it("derives phase layer ownership from keyframe-level phase links", () => {
    const ctx = createViewerContextFixture();

    const timeline = {
      duration: 8,
      phases: [],
      tracks: [
        {
          id: "background.opacity",
          keyframes: [
            { value: 0, id: "background-in", phaseId: "grid-in", time: 0 },
          ],
          layerId: "background",
          property: "opacity",
        },
      ],
    };

    expect([...ctx.getPhaseTrackLayerIds(timeline, "grid-in")]).toEqual([
      "background",
    ]);
    expect(
      ctx.isPhaseCompatibleWithLayer(timeline, "grid-in", "background"),
    ).toBe(true);
    expect(ctx.isPhaseCompatibleWithLayer(timeline, "grid-in", "title")).toBe(
      false,
    );
  });

  it("keeps scene and layer phases in one stable ownership lane", () => {
    const ctx = createViewerContextFixture();
    vi.spyOn(ctx, "clipBelongsToScene").mockReturnValue(false);
    vi.spyOn(ctx, "getKeyframeOwnershipSceneId").mockImplementation(
      (_timeline, track) => track?.sceneId ?? "main",
    );
    vi.spyOn(ctx, "getTrackKeyframesForParent").mockReturnValue([]);

    const tree = ctx.createTimelineRowTree({
      id: "fixture",
      clips: [],
      duration: 6,
      layers: [
        { id: "title", name: "Title", type: "text" },
        { id: "logo", name: "Logo", type: "rect" },
      ],
      scenes: [{ duration: 6, id: "main", start: 0 }],
      timeline: {
        phases: [
          { duration: 1, id: "scene-empty", sceneId: "main", start: 0 },
          { duration: 1, id: "scene-fade", sceneId: "main", start: 0 },
          { duration: 1, id: "title-in", sceneId: "main", start: 1 },
          { duration: 1, id: "logo-in", sceneId: "main", start: 2 },
          { duration: 1, id: "shared", sceneId: "main", start: 3 },
        ],
        tracks: [
          {
            id: "scene.opacity",
            keyframes: [{ value: 0, id: "scene-a", time: 0 }],
            phaseId: "scene-fade",
            sceneId: "main",
            target: "scene",
          },
          {
            id: "scene.rotation",
            keyframes: [{ value: 0, id: "scene-rotation-a", time: 4 }],
            sceneId: "main",
            target: "scene",
          },
          {
            id: "title.opacity",
            keyframes: [{ value: 0, id: "title-a", time: 1 }],
            phaseId: "title-in",
            target: "title",
          },
          {
            id: "logo.opacity",
            keyframes: [{ value: 0, id: "logo-a", time: 2 }],
            phaseId: "logo-in",
            target: "logo",
          },
          {
            id: "title.shared",
            keyframes: [{ value: 0, id: "title-shared", time: 3 }],
            phaseId: "shared",
            target: "title",
          },
          {
            id: "logo.shared",
            keyframes: [{ value: 0, id: "logo-shared", time: 3 }],
            phaseId: "shared",
            target: "logo",
          },
        ],
      },
    });

    const scene = requiredEntry(tree.scenes, 0);
    const layers = new Map(scene.layers.map((row) => [row.layerId, row]));
    const titleLayer = layers.get("title");
    if (titleLayer?.kind !== "layer")
      throw new Error("Missing title layer fixture");
    const logoLayer = layers.get("logo");
    if (logoLayer?.kind !== "layer")
      throw new Error("Missing logo layer fixture");

    expect(scene.scenePhases.map((row) => row.phase.id)).toEqual([
      "scene-empty",
      "scene-fade",
    ]);
    expect(scene.sceneTracks.map((row) => row.track.id)).toEqual([
      "scene.rotation",
    ]);
    const fade = scene.scenePhases.find((row) => row.phase.id === "scene-fade");
    if (!fade) throw new Error("Missing fade phase fixture");
    expect(fade.tracks.map((row) => row.track.id)).toEqual(["scene.opacity"]);
    expect(titleLayer.phases.map((row) => row.phase.id)).toEqual([
      "title-in",
      "shared",
    ]);
    expect(logoLayer.phases.map((row) => row.phase.id)).toEqual([
      "logo-in",
      "shared",
    ]);
  });

  it("builds nested structural group rows with dynamic depths", () => {
    const ctx = createViewerContextFixture();
    vi.spyOn(ctx, "clipBelongsToScene").mockReturnValue(false);
    vi.spyOn(ctx, "getKeyframeOwnershipSceneId").mockReturnValue("main");
    vi.spyOn(ctx, "getTrackKeyframesForParent").mockReturnValue([]);
    vi.spyOn(ctx, "getTrackLayerId").mockReturnValue(null);

    const tree = ctx.createTimelineRowTree({
      id: "fixture",
      clips: [],
      duration: 4,
      layers: [
        { id: "outer", type: "group" },
        { id: "card", parentId: "outer", type: "rect" },
        { id: "inner", parentId: "outer", type: "group" },
        { id: "title", parentId: "inner", type: "text" },
        { id: "logo", type: "imageAsset" },
      ],
      scenes: [{ duration: 4, id: "main", start: 0 }],
      timeline: { phases: [], tracks: [] },
    });

    const rows = requiredEntry(tree.scenes, 0).layers;
    const outer = requiredEntry(rows, 1);
    if (outer.kind !== "group") throw new Error("Missing outer group fixture");
    const inner = requiredEntry(outer.children, 0);
    if (inner.kind !== "group") throw new Error("Missing inner group fixture");
    expect(rows.map((row) => row.layerId)).toEqual(["logo", "outer"]);
    expect(rows[1]).toMatchObject({
      allLeafIds: ["card", "title"],
      depth: 1,
      kind: "group",
      layerId: "outer",
      leafIds: ["title", "card"],
    });
    expect(outer.children.map((row) => row.layerId)).toEqual(["inner", "card"]);
    expect(inner).toMatchObject({
      depth: 2,
      kind: "group",
      layerId: "inner",
    });
    expect(requiredEntry(inner.children, 0)).toMatchObject({
      depth: 3,
      kind: "layer",
      layerId: "title",
    });
  });
});

function requireTemplate(ctx: ReturnType<typeof createViewerContextFixture>) {
  const template = ctx.getEffectiveTemplate({
    id: "fixture",
    duration: 8,
    layers: [],
    clips: [],
    scenes: [],
  });
  if (!template) throw new Error("Missing fixture template");
  return template;
}
