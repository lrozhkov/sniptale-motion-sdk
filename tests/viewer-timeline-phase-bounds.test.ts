import { describe, expect, it } from "vitest";

import { getPhaseRowTimingBounds } from "../src/apps/viewer/timeline/model/phase-bounds";

describe("viewer timeline phase bounds", () => {
  it("keeps the declared phase interval authoritative", () => {
    expect(
      getPhaseRowTimingBounds({
        phase: { duration: 3, id: "title-in", start: 0 },
        tracks: [
          {
            keyframes: [
              { id: "title-a", time: 1.4 },
              { id: "title-b", time: 2.2 },
            ],
          },
          {
            keyframes: [{ id: "blur-a", time: 1.1 }],
          },
        ],
      }),
    ).toEqual({
      auto: false,
      duration: 3,
      end: 3,
      start: 0,
    });
  });

  it("derives bounds from keyframes only when a phase has no interval", () => {
    expect(
      getPhaseRowTimingBounds({
        phase: { duration: 0, id: "pulse", start: 0.5 },
        tracks: [
          {
            keyframes: [
              { id: "pulse-a", time: 1.25 },
              { id: "pulse-b", time: 1.75 },
            ],
          },
        ],
      }),
    ).toEqual({
      auto: true,
      duration: 0.5,
      end: 1.75,
      start: 1.25,
    });
  });

  it("keeps a visible minimum duration for one derived keyframe", () => {
    expect(
      getPhaseRowTimingBounds({
        phase: { id: "pulse" },
        tracks: [{ keyframes: [{ id: "pulse-a", time: 1.25 }] }],
      }),
    ).toEqual({
      auto: true,
      duration: 0.05,
      end: 1.25,
      start: 1.25,
    });
  });

  it("falls back to raw phase timing for runtime-only phases", () => {
    expect(
      getPhaseRowTimingBounds({
        phase: { duration: 0.8, id: "runtime", start: 2.4 },
        tracks: [],
      }),
    ).toEqual({
      auto: false,
      duration: 0.8,
      end: 3.2,
      start: 2.4,
    });
  });
});
