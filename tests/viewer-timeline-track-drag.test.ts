import { describe, expect, it } from "vitest";

import { calculateTrackDragBounds } from "../src/apps/viewer/timeline/model/track-drag-bounds";

describe("viewer timeline property-lane drag bounds", () => {
  it("keeps a phase-owned lane inside its phase and scene", () => {
    const bounds = calculateTrackDragBounds({
      duration: 10,
      keyframes: [
        { id: "first", time: 2.2 },
        { id: "last", time: 3.4 },
      ],
      phaseById: new Map([
        ["reveal", { duration: 1.5, id: "reveal", start: 2 }],
      ]),
      scene: { duration: 5, id: "main", start: 1 },
      track: { id: "title.opacity", phaseId: "reveal" },
    });

    expect(bounds.minDelta).toBeCloseTo(-0.2);
    expect(bounds.maxDelta).toBeCloseTo(0.1);
  });

  it("keeps a direct lane inside its scene without imposing a phase window", () => {
    const bounds = calculateTrackDragBounds({
      duration: 10,
      keyframes: [
        { id: "first", time: 1.2 },
        { id: "last", time: 4 },
      ],
      phaseById: new Map(),
      scene: { duration: 5, id: "main", start: 1 },
      track: { id: "title.x" },
    });

    expect(bounds.minDelta).toBeCloseTo(-0.2);
    expect(bounds.maxDelta).toBe(2);
  });
});
