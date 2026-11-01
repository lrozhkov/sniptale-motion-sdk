import { requiredEntry } from "./helpers/required-entry.js";
import type { DemoPackIssue } from "../src/sdk/demo-pack-validator/common.js";
import { describe, expect, it } from "vitest";

import { validateTimelineMotionPaths } from "../src/sdk/demo-pack-validator/motion-paths";

describe("demo pack motion path validation", () => {
  it("accepts paired spatial tracks and rejects mismatched references", () => {
    const template = createTemplate();
    const validErrors: DemoPackIssue[] = [];
    validateTimelineMotionPaths(template, "template", validErrors);
    expect(validErrors).toEqual([]);

    requiredEntry(
      requiredEntry(template.timeline.motionPaths, 0).points,
      1,
    ).yKeyframeId = "missing";
    const invalidErrors: DemoPackIssue[] = [];
    validateTimelineMotionPaths(template, "template", invalidErrors);
    expect(invalidErrors).toContainEqual({
      message: "Expected keyframe from the layer y track.",
      path: "template.timeline.motionPaths.0.points.1.yKeyframeId",
    });
  });
});

function createTemplate() {
  return {
    layers: [{ id: "card", type: "rect" }],
    timeline: {
      motionPaths: [
        {
          layerId: "card",
          points: [
            {
              kind: "linear",
              xKeyframeId: "x-a",
              yKeyframeId: "y-a",
            },
            {
              kind: "smooth",
              xKeyframeId: "x-b",
              yKeyframeId: "y-b",
            },
          ],
        },
      ],
      tracks: [
        {
          id: "card.x",
          keyframes: [
            { easing: "linear", id: "x-a", time: 0, value: 0 },
            { easing: "linear", id: "x-b", time: 1, value: 100 },
          ],
          layerId: "card",
          property: "x",
        },
        {
          id: "card.y",
          keyframes: [
            { easing: "linear", id: "y-a", time: 0, value: 0 },
            { easing: "linear", id: "y-b", time: 1, value: 100 },
          ],
          layerId: "card",
          property: "y",
        },
      ],
    },
  };
}
