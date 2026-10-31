import { getEditablePathPoints } from "../src/apps/viewer/canvas/path-overlay.js";
import { clamp } from "../src/sdk/protocol.js";
import { describe, expect, it } from "vitest";
import {
  readEditablePathPointDataset,
  readMotionPathPointDataset,
} from "../src/apps/viewer/canvas/path-point-dataset.js";

describe("canvas overlay DOM data", () => {
  it.each(
    [
      undefined,
      "",
      " ",
      "-1",
      "1.5",
      "01",
      "1e2",
      "9007199254740992",
      null,
      true,
      [],
      { toString: null },
    ].map((pointIndex: unknown) => ({ pointIndex })),
  )("rejects invalid point indexes: %j", ({ pointIndex }) => {
    expect(
      readEditablePathPointDataset({ layerId: "card", pointIndex }),
    ).toBeNull();
  });
  it("preserves a real zero index and arbitrary valid layer identifiers", () => {
    expect(
      readEditablePathPointDataset({ layerId: 'слой:a/"b', pointIndex: "0" }),
    ).toEqual({ layerId: 'слой:a/"b', pointIndex: 0 });
    expect(
      readEditablePathPointDataset({ layerId: "card", pointIndex: "12" }),
    ).toEqual({ layerId: "card", pointIndex: 12 });
  });
  it.each(["layerId", "xKeyframeId", "yKeyframeId"])(
    "requires an actual identifier at %s",
    (field) => {
      for (const value of [undefined, "", 1, true, [], { toString: null }]) {
        expect(
          readMotionPathPointDataset({
            layerId: "card",
            xKeyframeId: "x",
            yKeyframeId: "y",
            [field]: value,
          }),
        ).toBeNull();
      }
    },
  );
  it("preserves all valid motion-point identifiers", () => {
    const ref = { layerId: "слой:a", xKeyframeId: "x:y/z", yKeyframeId: 'y"z' };
    expect(readMotionPathPointDataset(ref)).toEqual(ref);
  });
});

describe("editable path coordinates", () => {
  it.each(
    [null, true, "12", [], [12], { toString: null }, NaN, Infinity].map(
      (value: unknown) => ({ value }),
    ),
  )("rejects malformed points without conversion: %j", ({ value }) => {
    const layer = {
      id: "path",
      type: "path",
      pathPoints: [
        { x: 0, y: 0 },
        { x: value, y: 1 },
      ],
    };
    expect(getEditablePathPoints({ deps: { clamp } }, layer)).toEqual([]);
  });
  it("keeps point order and finite zeroes while clamping editable bounds", () => {
    expect(
      getEditablePathPoints(
        { deps: { clamp } },
        {
          id: "path",
          type: "path",
          pathPoints: [
            { x: 0, y: 0 },
            { x: -3, y: 5 },
          ],
        },
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: -2, y: 2 },
    ]);
  });
});
