import { describe, expect, it } from "vitest";

import { resolveCanvasGuideSnap } from "../src/apps/viewer/canvas/guide-snap";
import {
  getCanvasSnapAnchorValues,
  resolveCanvasGuideSnapForAnchors,
} from "../src/apps/viewer/canvas/guide-snap-axis";

const GUIDES = [
  { label: "Center", value: 100 },
  { label: "End", value: 200 },
];

describe("viewer canvas guide snapping", () => {
  it("captures the nearest guide inside the pointer tolerance", () => {
    const snap = resolveCanvasGuideSnap(94, GUIDES, {
      captureTolerance: 8,
      releaseTolerance: 14,
    });

    expect(snap.guide).toEqual(GUIDES[0]);
    expect(snap.delta).toBe(6);
  });

  it("holds a captured guide until the wider release threshold", () => {
    const snap = resolveCanvasGuideSnap(111, GUIDES, {
      captureTolerance: 8,
      lockedGuide: GUIDES[0],
      releaseTolerance: 14,
    });

    expect(snap.guide).toEqual(GUIDES[0]);
    expect(snap.delta).toBe(-11);
  });

  it("releases a guide after the pointer leaves its hysteresis range", () => {
    const snap = resolveCanvasGuideSnap(115, GUIDES, {
      captureTolerance: 8,
      lockedGuide: GUIDES[0],
      releaseTolerance: 14,
    });

    expect(snap.guide).toBeNull();
    expect(snap.delta).toBe(0);
  });

  it("blends out a captured guide without a release-frame jump", () => {
    const options = {
      captureTolerance: 8,
      lockedGuide: GUIDES[0],
      releaseBlendTolerance: 10,
      releaseTolerance: 14,
    };
    const atThreshold = resolveCanvasGuideSnap(114, GUIDES, options);
    const firstReleased = resolveCanvasGuideSnap(115, GUIDES, options);
    const fartherReleased = resolveCanvasGuideSnap(118, GUIDES, options);

    expect(atThreshold.delta).toBe(-14);
    expect(atThreshold.snapped).toBe(true);
    expect(firstReleased.delta).toBeCloseTo(-14.58);
    expect(firstReleased.snapped).toBe(true);
    expect(firstReleased.guide).toEqual(GUIDES[0]);
    expect(fartherReleased.delta).toBeCloseTo(-11.664);
    expect(115 + firstReleased.delta).toBeCloseTo(100.42);
    expect(118 + fartherReleased.delta).toBeCloseTo(106.336);
  });

  it("finishes the release blend at the raw pointer position", () => {
    const snap = resolveCanvasGuideSnap(124, GUIDES, {
      captureTolerance: 8,
      lockedGuide: GUIDES[0],
      releaseBlendTolerance: 10,
      releaseTolerance: 14,
    });

    expect(snap.guide).toBeNull();
    expect(snap.delta).toBe(0);
    expect(snap.snapped).toBe(false);
  });

  it("acquires a guide progressively before locking onto its core", () => {
    const options = {
      captureCoreTolerance: 2,
      captureTolerance: 8,
      releaseBlendTolerance: 10,
      releaseTolerance: 14,
    };
    const entering = resolveCanvasGuideSnap(94, GUIDES, options);
    const captured = resolveCanvasGuideSnap(98, GUIDES, options);

    expect(entering.delta).toBeCloseTo(1.5556, 3);
    expect(entering.locked).toBe(false);
    expect(entering.snapped).toBe(true);
    expect(captured.delta).toBe(2);
    expect(captured.locked).toBe(true);
  });

  it("keeps a monotonic trajectory through the complete release blend", () => {
    const projected = Array.from({ length: 12 }, (_, index) => 114 + index).map(
      (value) => {
        const snap = resolveCanvasGuideSnap(value, GUIDES, {
          captureCoreTolerance: 2,
          captureTolerance: 8,
          lockedGuide: GUIDES[0],
          releaseBlendTolerance: 10,
          releaseTolerance: 14,
        });
        return value + snap.delta;
      },
    );

    expect(projected.at(-2)).toBeLessThan(projected.at(-1));
    expect(projected.at(-1)).toBe(125);
    expect(
      projected.slice(1).every((value, index) => value >= projected[index]),
    ).toBe(true);
  });

  it("snaps the nearest visible edge instead of only the layer center", () => {
    const snap = resolveCanvasGuideSnapForAnchors(
      100,
      [50, 0, 100],
      [{ label: "End", value: 200 }],
      { captureTolerance: 8, releaseTolerance: 14 },
    );

    expect(snap.anchorOffset).toBe(100);
    expect(snap.delta).toBe(0);
    expect(snap.lock).toEqual({
      anchorOffset: 100,
      guide: { label: "End", value: 200 },
    });
  });

  it("keeps the captured anchor when another anchor becomes closer", () => {
    const guide = { label: "End", value: 200 };
    const snap = resolveCanvasGuideSnapForAnchors(
      106,
      [50, 100],
      [guide, { label: "Competing", value: 156 }],
      {
        captureTolerance: 8,
        lock: { anchorOffset: 100, guide },
        releaseTolerance: 14,
      },
    );

    expect(snap.anchorOffset).toBe(100);
    expect(snap.guide).toBe(guide);
    expect(snap.delta).toBe(-6);
  });

  it("releases one anchor before acquiring a competing target", () => {
    const guide = { label: "End", value: 200 };
    const released = resolveCanvasGuideSnapForAnchors(
      125,
      [50, 100],
      [guide, { label: "Competing", value: 180 }],
      {
        captureTolerance: 8,
        lock: { anchorOffset: 100, guide },
        releaseBlendTolerance: 10,
        releaseTolerance: 14,
      },
    );
    const reacquired = resolveCanvasGuideSnapForAnchors(
      125,
      [50, 100],
      [guide, { label: "Competing", value: 180 }],
      {
        captureTolerance: 8,
        releaseBlendTolerance: 10,
        releaseTolerance: 14,
      },
    );

    expect(released.snapped).toBe(false);
    expect(released.lock).toBeNull();
    expect(reacquired.guide?.label).toBe("Competing");
    expect(reacquired.anchorOffset).toBe(50);
  });

  it("derives edge and center anchors from the rotated visible bounds", () => {
    const anchors = getCanvasSnapAnchorValues(
      { height: 40, rotation: 90, width: 100, x: 20, y: 30 },
      { x: 70, y: 50 },
    );

    expect(anchors.x).toEqual([70, 50, 90]);
    expect(anchors.y).toEqual([50, 0, 100]);
  });

  it("keeps the projected trajectory monotonic across competing anchors", () => {
    const guides = [
      { label: "33%", value: 1280 / 3 },
      { label: "Center", value: 640 },
      { label: "66%", value: (1280 * 2) / 3 },
    ];
    const anchorOffsets = [-70, 0, 70];
    let lock = null;
    const projected = [];
    for (let position = 480; position <= 880; position += 4) {
      const snap = resolveCanvasGuideSnapForAnchors(
        position,
        anchorOffsets,
        guides,
        {
          captureCoreTolerance: 2,
          captureTolerance: 8,
          lock,
          releaseBlendTolerance: 24,
          releaseTolerance: 8,
        },
      );
      lock = snap.lock;
      projected.push(position + snap.delta);
    }

    expect(
      projected.slice(1).every((value, index) => value >= projected[index]),
    ).toBe(true);
  });
});
