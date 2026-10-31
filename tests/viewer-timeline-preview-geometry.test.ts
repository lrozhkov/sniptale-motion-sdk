import { afterEach, describe, expect, it, vi } from "vitest";

import { syncTimelineInteractionGeometry } from "../src/apps/viewer/timeline/interaction/preview-geometry";

describe("viewer timeline interaction preview geometry", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("updates visible timing geometry without rebuilding timeline rows", () => {
    vi.stubGlobal("HTMLElement", FakeElement);
    const scene = new FakeElement({ sceneId: "scene" });
    const clipLane = new FakeElement({ parentSceneId: "scene" });
    const clip = new FakeElement({ layerId: "card" }, clipLane);
    const phaseLane = new FakeElement({ layerId: "card" });
    const phase = new FakeElement({ phaseId: "reveal" }, phaseLane);
    const point = new FakeElement({
      keyframeId: "lift-a",
      trackId: "card.lift",
    });
    const segment = new FakeElement({
      fromKeyframeId: "lift-a",
      toKeyframeId: "lift-b",
      trackId: "card.lift",
    });
    const elements = new Map([
      [".scene-block[data-scene-id]", [scene]],
      [".clip-block[data-layer-id]", [clip]],
      [".phase-block[data-phase-id]", [phase]],
      [".keyframe-point[data-track-id][data-keyframe-id]", [point]],
      [".keyframe-segment-range[data-track-id]", [segment]],
    ]);
    const timeline = {
      duration: 10,
      phases: [{ duration: 1.5, id: "reveal", start: 2 }],
      tracks: [
        {
          id: "card.lift",
          keyframes: [
            { id: "lift-a", phaseId: "reveal", time: 2.25, value: 0 },
            { id: "lift-b", phaseId: "reveal", time: 3.25, value: 0 },
          ],
          layerId: "card",
          property: "x",
        },
      ],
    };
    const ctx = {
      deps: {
        clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
      },
      getEffectiveDuration: () => 10,
      getEffectiveTemplate: () => ({
        clips: [{ duration: 4, layerId: "card", start: 1 }],
        scenes: [{ duration: 6, id: "scene", start: 0.5 }],
      }),
      getSceneClampedClipInterval: (value) => ({
        effectiveEnd: value.start + value.duration,
        effectiveStart: value.start,
        rawEnd: value.start + value.duration,
        rawStart: value.start,
      }),
      getTrackLayerId: (track) => track.layerId,
      normalizeScenes: (scenes) => scenes,
      refs: {
        timelineTracks: {
          querySelectorAll: (selector) => elements.get(selector) ?? [],
        },
      },
      timelineDurationPercent: (value, duration) => (value / duration) * 100,
      timelinePercent: (value, duration) => (value / duration) * 100,
    } as any;

    syncTimelineInteractionGeometry(ctx, { id: "template" }, timeline);

    expect(scene.style).toMatchObject({ left: "5%", width: "60%" });
    expect(clip.style).toMatchObject({ left: "10%", width: "40%" });
    expect(clip.dataset).toMatchObject({
      effectiveEnd: "5",
      effectiveStart: "1",
      rawEnd: "5",
      rawStart: "1",
    });
    expect(phase.style).toMatchObject({ left: "20%", width: "15%" });
    expect(point.style.left).toBe("22.5%");
    expect(point.classList.has("edge-start")).toBe(false);
    expect(point.classList.has("edge-end")).toBe(false);
    expect(segment.style).toMatchObject({ left: "22.5%", width: "10%" });
  });

  it("derives auto phase geometry from the matching layer tracks", () => {
    vi.stubGlobal("HTMLElement", FakeElement);
    const phaseLane = new FakeElement({ layerId: "card" });
    const phase = new FakeElement({ phaseId: "auto" }, phaseLane);
    const ctx = {
      getEffectiveDuration: () => 8,
      getEffectiveTemplate: () => ({ clips: [], scenes: [] }),
      getTrackLayerId: (track) => track.layerId,
      normalizeScenes: () => [],
      refs: {
        timelineTracks: {
          querySelectorAll: (selector) =>
            selector === ".phase-block[data-phase-id]" ? [phase] : [],
        },
      },
      timelineDurationPercent: (value, duration) => (value / duration) * 100,
      timelinePercent: (value, duration) => (value / duration) * 100,
    } as any;

    syncTimelineInteractionGeometry(
      ctx,
      { id: "template" },
      {
        duration: 8,
        phases: [{ id: "auto", start: NaN, duration: NaN }],
        tracks: [
          {
            id: "card.x",
            keyframes: [
              { id: "a", phaseId: "auto", time: 1, value: 0 },
              { id: "b", phaseId: "auto", time: 3, value: 0 },
            ],
            layerId: "card",
            property: "x",
          },
          {
            id: "grid.x",
            keyframes: [
              { id: "c", phaseId: "auto", time: 5, value: 0 },
              { id: "d", phaseId: "auto", time: 7, value: 0 },
            ],
            layerId: "grid",
            property: "x",
          },
        ],
      },
    );

    expect(phase.style).toMatchObject({ left: "12.5%", width: "25%" });
  });
});

class FakeElement {
  classList = new SetClassList();
  dataset: Record<string, string>;
  parentLane: FakeElement | null;
  style: Record<string, string> = {};

  constructor(
    dataset: Record<string, string> = {},
    parentLane: FakeElement | null = null,
  ) {
    this.dataset = dataset;
    this.parentLane = parentLane;
  }

  closest(selector: string): FakeElement | null {
    return selector === ".timeline-lane" ? this.parentLane : null;
  }
}

class SetClassList {
  private values = new Set<string>();

  has(value: string): boolean {
    return this.values.has(value);
  }

  toggle(value: string, force?: boolean): boolean {
    if (force === false) {
      this.values.delete(value);
      return false;
    }
    if (force === true) {
      this.values.add(value);
      return true;
    }
    if (this.values.has(value)) {
      this.values.delete(value);
      return false;
    }
    this.values.add(value);
    return true;
  }
}
