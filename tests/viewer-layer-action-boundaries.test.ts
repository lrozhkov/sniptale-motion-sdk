import { describe, expect, it } from "vitest";
import { createLayerSiblingMove } from "../src/apps/viewer/layers/order";
import { createLayerDistributionUpdates } from "../src/apps/viewer/layers/selection-layout";
const layers = [
  { id: "a", type: "rect" },
  { id: "b", type: "rect" },
];
describe("layer operation boundaries", () => {
  it.each([Infinity, -Infinity, 0.5, "1"])(
    "rejects nonfinite or noninteger order deltas: %j",
    (delta) => {
      expect(createLayerSiblingMove(layers, ["a"], delta)).toBeNull();
    },
  );
  it("does not create invalid distribution coordinates for an empty selection", () => {
    expect(createLayerDistributionUpdates([], "horizontal")).toEqual({});
  });
});
