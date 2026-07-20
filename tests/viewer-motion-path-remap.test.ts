import { describe, expect, it } from "vitest";
import {
  duplicateLayerMotionPaths,
  removeLayerMotionPaths,
} from "../src/apps/viewer/layers/motion-path-remap";

const path = {
  layerId: "box",
  points: [
    {
      inTangent: { x: 0, y: 0 },
      kind: "smooth" as const,
      outTangent: { x: 20, y: -10 },
      xKeyframeId: "box-x-a",
      yKeyframeId: "box-y-a",
    },
  ],
};

describe("layer motion path remapping", () => {
  it("remaps the layer and paired keyframe ids during duplication", () => {
    expect(
      duplicateLayerMotionPaths([path], new Map([["box", "rect-2"]])),
    ).toEqual([
      {
        layerId: "rect-2",
        points: [
          {
            inTangent: { x: 0, y: 0 },
            kind: "smooth",
            outTangent: { x: 20, y: -10 },
            xKeyframeId: "rect-2-x-a",
            yKeyframeId: "rect-2-y-a",
          },
        ],
      },
    ]);
  });

  it("removes paths owned by deleted subtrees", () => {
    expect(removeLayerMotionPaths([path], new Set(["box"]))).toEqual([]);
  });
});
