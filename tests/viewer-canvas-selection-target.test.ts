import type { CanvasSelectionTrack } from "../src/apps/viewer/canvas/selection-target.js";
import type { ViewerSelection } from "../src/apps/viewer/timeline/model/selection-model.js";
import { describe, expect, it } from "vitest";

import { resolveCanvasSelectionLayerId } from "../src/apps/viewer/canvas/selection-target";

const layers = [{ id: "card" }, { id: "title" }];
const timeline = {
  tracks: [
    {
      id: "card.x",
      keyframes: [{ id: "card-x-a", phaseId: "card-in" }],
      target: "card",
    },
    {
      id: "title.opacity",
      keyframes: [{ id: "title-opacity-a", phaseId: "shared" }],
      target: "title",
    },
    {
      id: "card.opacity",
      keyframes: [{ id: "card-opacity-a", phaseId: "shared" }],
      target: "card",
    },
  ],
};
const getTrackLayerId = (track: CanvasSelectionTrack) => track?.target ?? null;

function resolve(item: ViewerSelection) {
  return resolveCanvasSelectionLayerId({
    getTrackLayerId,
    item,
    layers,
    timeline,
  });
}

describe("viewer canvas selection target", () => {
  it("keeps a layer visible when its timeline interval is selected", () => {
    expect(resolve({ layerId: "card", type: "clip" })).toBe("card");
  });

  it("resolves property tracks and keyframes to their visual layer", () => {
    expect(resolve({ trackId: "card.x", type: "track" })).toBe("card");
    expect(
      resolve({
        keyframeId: "card-x-a",
        trackId: "card.x",
        type: "keyframe",
      }),
    ).toBe("card");
  });

  it("shows a phase only when it has one unambiguous visual owner", () => {
    expect(resolve({ phaseId: "card-in", type: "phase" })).toBe("card");
    expect(resolve({ phaseId: "shared", type: "phase" })).toBeNull();
  });
});
