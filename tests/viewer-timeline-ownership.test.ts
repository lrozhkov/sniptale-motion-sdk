import { describe, expect, it } from "vitest";

import { createTimelineOwnershipPredicates } from "../src/apps/viewer/timeline/model/ownership-predicates";
import {
  createTimelineRowTree,
  createTimelineRowTreeActions,
} from "../src/apps/viewer/timeline/model/row-tree";
import { createTimelineNavigationActions } from "../src/apps/viewer/timeline/model/selection-navigation";

describe("viewer timeline ownership predicates", () => {
  it("keeps a composition-end keyframe in the final timeline scope", () => {
    const template = { duration: 8 };
    const ctx: any = {
      getEffectiveDuration: (candidate: any) => candidate.duration,
      getEffectiveTimeline: () => ({ tracks: [] }),
      getKeyframeOwnershipSceneId: () => null,
      state: { currentTemplate: template },
    };
    Object.assign(
      ctx,
      createTimelineOwnershipPredicates(() => ctx),
    );

    const track = { id: "background.opacity" };
    const keyframe = { id: "background-end", time: 8 };
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
    const ctx: any = {
      createTimelineRowTree: () => ({
        globalLayers: [
          {
            clip: { layerId: "background" },
            directTracks: [],
            expansionId: "__global__:background",
            layerId: "background",
            phases: [],
          },
        ],
        scenes: [
          {
            layers: [],
            scene: { id: "intro" },
            scenePhases: [],
            sceneTracks: [],
          },
        ],
      }),
      isSceneExpanded: () => false,
      isTimelineRowExpanded: () => false,
    };
    Object.assign(
      ctx,
      createTimelineNavigationActions(() => ctx),
    );

    expect(ctx.getVisibleTimelineSelectionItems({})).toEqual([
      { layerId: "background", sceneId: null, type: "layer" },
      { layerId: "background", sceneId: null, type: "clip" },
      { sceneId: "intro", type: "scene" },
    ]);
    expect(ctx.getInspectorFocusTabForSelection({ type: "keyframe" })).toBe(
      "timing",
    );
  });

  it("separates a cross-scene unscoped clip into the global timeline scope", () => {
    const ctx: any = {
      getEffectiveDuration: (template: any) => template.duration,
      getEffectiveTemplate: (template: any) => template,
      getEffectiveTimeline: (template: any) => template.timeline,
      getKeyframeOwnershipSceneId: () => null,
      getTrackKeyframesForParent: () => [],
      getTrackLayerId: (track: any) => track.layerId ?? track.target ?? null,
      isRangeInsideScene: (start: number, duration: number, scene: any) =>
        start >= scene.start &&
        start + duration <= scene.start + scene.duration,
      normalizeScenes: (scenes: any[]) => scenes,
    };
    Object.assign(
      ctx,
      createTimelineOwnershipPredicates(() => ctx),
    );
    Object.assign(
      ctx,
      createTimelineRowTreeActions(() => ctx),
      {
        createTimelineRowTree: (template: unknown) =>
          createTimelineRowTree(ctx, template),
      },
    );

    const tree = ctx.createTimelineRowTree({
      clips: [
        { duration: 8, layerId: "background", sceneId: null, start: 0 },
        { duration: 2, layerId: "title", sceneId: null, start: 1 },
      ],
      duration: 8,
      layers: [{ id: "background" }, { id: "title" }],
      scenes: [
        { duration: 4, id: "intro", start: 0 },
        { duration: 4, id: "outro", start: 4 },
      ],
      timeline: { phases: [], tracks: [] },
    });

    expect(tree.globalLayers.map((row: any) => row.layerId)).toEqual([
      "background",
    ]);
    expect(
      tree.scenes.flatMap((scene: any) =>
        scene.layers.map((row: any) => `${scene.scene.id}:${row.layerId}`),
      ),
    ).toEqual(["intro:title"]);
  });

  it("derives phase layer ownership from keyframe-level phase links", () => {
    const ctx: any = {
      getTrackLayerId: (track: any) => track.layerId ?? track.target ?? null,
    };
    Object.assign(
      ctx,
      createTimelineOwnershipPredicates(() => ctx),
    );

    const timeline = {
      tracks: [
        {
          id: "background.opacity",
          keyframes: [{ id: "background-in", phaseId: "grid-in", time: 0 }],
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
    const ctx: any = {
      clipBelongsToScene: () => false,
      getEffectiveDuration: (template: any) => template.duration,
      getEffectiveTemplate: (template: any) => template,
      getEffectiveTimeline: (template: any) => template.timeline,
      getKeyframeOwnershipSceneId: (_timeline: any, track: any) =>
        track.sceneId ?? "main",
      getTrackKeyframesForParent: () => [],
      getTrackLayerId: (track: any) =>
        track.layerId ?? (track.target === "scene" ? null : track.target),
      normalizeScenes: (scenes: any[]) => scenes,
    };
    Object.assign(
      ctx,
      createTimelineOwnershipPredicates(() => ctx),
    );
    Object.assign(
      ctx,
      createTimelineRowTreeActions(() => ctx),
      {
        createTimelineRowTree: (template: unknown) =>
          createTimelineRowTree(ctx, template),
      },
    );

    const tree = ctx.createTimelineRowTree({
      clips: [],
      duration: 6,
      layers: [
        { id: "title", name: "Title" },
        { id: "logo", name: "Logo" },
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
            keyframes: [{ id: "scene-a", time: 0 }],
            phaseId: "scene-fade",
            sceneId: "main",
            target: "scene",
          },
          {
            id: "scene.rotation",
            keyframes: [{ id: "scene-rotation-a", time: 4 }],
            sceneId: "main",
            target: "scene",
          },
          {
            id: "title.opacity",
            keyframes: [{ id: "title-a", time: 1 }],
            phaseId: "title-in",
            target: "title",
          },
          {
            id: "logo.opacity",
            keyframes: [{ id: "logo-a", time: 2 }],
            phaseId: "logo-in",
            target: "logo",
          },
          {
            id: "title.shared",
            keyframes: [{ id: "title-shared", time: 3 }],
            phaseId: "shared",
            target: "title",
          },
          {
            id: "logo.shared",
            keyframes: [{ id: "logo-shared", time: 3 }],
            phaseId: "shared",
            target: "logo",
          },
        ],
      },
    });

    const scene = tree.scenes[0];
    const layers = new Map(scene.layers.map((row: any) => [row.layerId, row]));
    const titleLayer: any = layers.get("title");
    const logoLayer: any = layers.get("logo");

    expect(scene.scenePhases.map((row: any) => row.phase.id)).toEqual([
      "scene-empty",
      "scene-fade",
    ]);
    expect(scene.sceneTracks.map((row: any) => row.track.id)).toEqual([
      "scene.rotation",
    ]);
    expect(
      scene.scenePhases
        .find((row: any) => row.phase.id === "scene-fade")
        .tracks.map((row: any) => row.track.id),
    ).toEqual(["scene.opacity"]);
    expect(titleLayer.phases.map((row: any) => row.phase.id)).toEqual([
      "title-in",
      "shared",
    ]);
    expect(logoLayer.phases.map((row: any) => row.phase.id)).toEqual([
      "logo-in",
      "shared",
    ]);
  });

  it("builds nested structural group rows with dynamic depths", () => {
    const ctx: any = {
      clipBelongsToScene: () => false,
      getEffectiveDuration: (template: any) => template.duration,
      getEffectiveTemplate: (template: any) => template,
      getEffectiveTimeline: (template: any) => template.timeline,
      getKeyframeOwnershipSceneId: () => "main",
      getTrackKeyframesForParent: () => [],
      getTrackLayerId: () => null,
      normalizeScenes: (scenes: any[]) => scenes,
    };
    Object.assign(
      ctx,
      createTimelineOwnershipPredicates(() => ctx),
    );
    Object.assign(
      ctx,
      createTimelineRowTreeActions(() => ctx),
      {
        createTimelineRowTree: (template: unknown) =>
          createTimelineRowTree(ctx, template),
      },
    );

    const tree = ctx.createTimelineRowTree({
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

    const rows = tree.scenes[0].layers;
    expect(rows.map((row: any) => row.layerId)).toEqual(["logo", "outer"]);
    expect(rows[1]).toMatchObject({
      allLeafIds: ["card", "title"],
      depth: 1,
      kind: "group",
      layerId: "outer",
      leafIds: ["title", "card"],
    });
    expect(rows[1].children.map((row: any) => row.layerId)).toEqual([
      "inner",
      "card",
    ]);
    expect(rows[1].children[0]).toMatchObject({
      depth: 2,
      kind: "group",
      layerId: "inner",
    });
    expect(rows[1].children[0].children[0]).toMatchObject({
      depth: 3,
      kind: "layer",
      layerId: "title",
    });
  });
});
