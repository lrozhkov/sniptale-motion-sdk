import { afterEach, describe, expect, it, vi } from "vitest";

import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import type { EditorTemplate } from "../src/apps/viewer/templates/model.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer scene move ownership", () => {
  it("does not move cross-scene global layer timing with a scene", () => {
    const ctx = createViewerContextFixture();
    const template: EditorTemplate = {
      id: "composition",
      layers: [],
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
        duration: 8,
        phases: [
          { duration: 8, id: "ambience", sceneId: null, start: 0 },
          { duration: 2, id: "title-in", sceneId: "intro", start: 0.5 },
        ],
        tracks: [
          {
            id: "background.opacity",
            keyframes: [
              { id: "background-a", phaseId: "ambience", time: 0, value: 1 },
              { id: "background-b", phaseId: "ambience", time: 8, value: 1 },
            ],
            layerId: "background",
            phaseId: "ambience",
          },
          {
            id: "title.opacity",
            keyframes: [
              { id: "title-a", phaseId: "title-in", time: 0.5, value: 1 },
              { id: "title-b", phaseId: "title-in", time: 2.5, value: 1 },
            ],
            layerId: "title",
            phaseId: "title-in",
            sceneId: "intro",
          },
        ],
      },
    };

    const plan = ctx.createSceneMovePlan(template, ["intro"], 8, true);

    expect(plan.clipItems.map((item) => item.layerId)).toEqual(["title"]);
    expect(plan.phaseItems.map((item) => item.phaseId)).toEqual(["title-in"]);
    expect(plan.keyframeItems.map((item) => item.keyframeId)).toEqual([
      "title-a",
      "title-b",
    ]);
    expect(plan.maxDelta).toBe(4);
  });
});
