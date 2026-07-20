import { describe, expect, it } from "vitest";

import { deepClone } from "../src/apps/viewer/editor/model";
import { installModelPhaseSceneMovePlansOwner } from "../src/apps/viewer/timeline/model/phase-scene-move-plans";
import { installTimelineOwnershipPredicatesOwner } from "../src/apps/viewer/timeline/model/ownership-predicates";

describe("viewer scene move ownership", () => {
  it("does not move cross-scene global layer timing with a scene", () => {
    const ctx: any = {
      deps: { deepClone },
      getTrackLayerId: (track: any) => track.layerId ?? track.target ?? null,
      isRangeInsideScene: (start: number, duration: number, scene: any) =>
        start >= scene.start &&
        start + duration <= scene.start + scene.duration,
      normalizeScenes: (scenes: any[]) => scenes,
    };
    installTimelineOwnershipPredicatesOwner(ctx);
    installModelPhaseSceneMovePlansOwner(ctx);
    const template = {
      clips: [
        { duration: 8, layerId: "background", sceneId: null, start: 0 },
        { duration: 3, layerId: "title", sceneId: "intro", start: 0.5 },
      ],
      duration: 8,
      scenes: [
        { duration: 4, id: "intro", start: 0 },
        { duration: 4, id: "outro", start: 4 },
      ],
      timeline: {
        phases: [
          { duration: 8, id: "ambience", sceneId: null, start: 0 },
          { duration: 2, id: "title-in", sceneId: "intro", start: 0.5 },
        ],
        tracks: [
          {
            id: "background.opacity",
            keyframes: [
              { id: "background-a", phaseId: "ambience", time: 0 },
              { id: "background-b", phaseId: "ambience", time: 8 },
            ],
            layerId: "background",
            phaseId: "ambience",
          },
          {
            id: "title.opacity",
            keyframes: [
              { id: "title-a", phaseId: "title-in", time: 0.5 },
              { id: "title-b", phaseId: "title-in", time: 2.5 },
            ],
            layerId: "title",
            phaseId: "title-in",
            sceneId: "intro",
          },
        ],
      },
    };

    const plan = ctx.createSceneMovePlan(template, ["intro"], 8, true);

    expect(plan.clipItems.map((item: any) => item.layerId)).toEqual(["title"]);
    expect(plan.phaseItems.map((item: any) => item.phaseId)).toEqual([
      "title-in",
    ]);
    expect(plan.keyframeItems.map((item: any) => item.keyframeId)).toEqual([
      "title-a",
      "title-b",
    ]);
    expect(plan.maxDelta).toBe(4);
  });
});
