import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

import { createGraphEditorModel } from "../src/apps/viewer/graph-editor/model.js";
import {
  createFittedGraphViewport,
  graphTimeToX,
  graphValueToY,
  graphXToTime,
  graphYToValue,
} from "../src/apps/viewer/graph-editor/viewport.js";
import {
  createGraphTrackPath,
  getGraphTrackColor,
} from "../src/apps/viewer/graph-editor/curve-path";
import {
  clampTrackNumericValue,
  getTrackNumericPropertyRange,
} from "../src/apps/viewer/layers/property-range";

describe("viewer Graph Editor", () => {
  it("builds a multi-track numeric model from canonical selection", () => {
    const timeline = createTimeline();
    const ctx = createViewerContextFixture();
    ctx.state.currentTemplate = {
      id: "template",
      duration: 4,
      layers: [{ id: "card", type: "rect" }],
    };
    ctx.state.selectedKeyframes = [
      { keyframeId: "opacity-a", trackId: "opacity" },
      { keyframeId: "scale-a", trackId: "scale" },
    ];
    vi.spyOn(ctx, "getPrimaryKeyframeSelection").mockReturnValue({
      keyframeId: "scale-a",
      trackId: "scale",
    });
    vi.spyOn(ctx, "getLayerContentFields").mockReturnValue([]);

    const model = createGraphEditorModel(ctx, timeline);
    if (!model) throw new Error("Expected a numeric graph model");

    expect(model.tracks.map((track) => track.id)).toEqual(["opacity", "scale"]);
    expect(model.selection).toHaveLength(2);
    expect(model.multiTrack).toBe(true);
    expect(model.primary?.keyframeId).toBe("scale-a");
    expect(model.tracks[0]?.valueRange).toEqual({ max: 1, min: 0 });
    expect(model.viewport.timeStart).toBeLessThan(1);
    expect(model.viewport.timeEnd).toBeGreaterThan(2);
  });

  it("uses content schema bounds and leaves unknown properties extensible", () => {
    const ctx = createViewerContextFixture();
    vi.spyOn(ctx, "getLayerContentFields").mockReturnValue([
      {
        kind: "number",
        max: 240,
        min: 0,
        property: "radius",
        label: "Radius",
        defaultValue: 0,
        step: 1,
      },
    ]);
    vi.spyOn(ctx, "getTrackLayerId").mockReturnValue("card");
    const template = { layers: [{ id: "card", type: "rect" }] };

    expect(
      getTrackNumericPropertyRange(ctx, template, { property: "radius" }),
    ).toEqual({ max: 240, min: 0 });
    expect(
      getTrackNumericPropertyRange(ctx, template, { property: "customValue" }),
    ).toBeNull();
    expect(clampTrackNumericValue(1.4, { max: 1, min: 0 })).toBe(1);
    expect(clampTrackNumericValue(1.4, null)).toBe(1.4);
  });

  it("keeps graph coordinate conversions reversible", () => {
    const viewport = {
      templateId: "template",
      timeEnd: 5,
      timeStart: 1,
      valueMax: 20,
      valueMin: -10,
    };
    expect(graphXToTime(graphTimeToX(3, viewport), viewport)).toBeCloseTo(3);
    expect(graphYToValue(graphValueToY(5, viewport), viewport)).toBeCloseTo(5);
  });

  it("fits only the requested identities when track and keyframe ids contain delimiters", () => {
    const viewport = createFittedGraphViewport(
      "source",
      [
        {
          id: "a:b",
          points: [
            { id: "c", time: 1, value: 1 },
            { id: "d", time: 2, value: 2 },
          ],
        },
        { id: "a", points: [{ id: "b:c", time: 99, value: 999 }] },
      ],
      [
        { trackId: "a:b", keyframeId: "c" },
        { trackId: "a:b", keyframeId: "d" },
      ],
      100,
    );
    expect(viewport.timeEnd).toBeLessThan(3);
    expect(viewport.valueMax).toBeLessThan(3);
  });

  it("handles empty geometry, incomplete handles and palette overflow deterministically", () => {
    const viewport = {
      templateId: "source",
      timeStart: 0,
      timeEnd: 1,
      valueMin: 0,
      valueMax: 1,
    };
    expect(createGraphTrackPath({ points: [] }, viewport)).toBe("");
    const path = createGraphTrackPath(
      {
        points: [
          { time: 0, value: 0, easing: "bezier" },
          { time: 1, value: 1 },
        ],
      },
      viewport,
    );
    expect(path).toContain("C");
    expect(path).not.toMatch(/NaN|undefined/);
    expect(getGraphTrackColor({ colorIndex: 6 })).toBe("#72dbe6");
    expect(getGraphTrackColor({ colorIndex: Number.NaN })).toBe("#72dbe6");
  });

  it("renders bezier and hold segments using value geometry", () => {
    const viewport = createFittedGraphViewport(
      "template",
      [
        {
          id: "opacity",
          points: [
            { id: "a", time: 0, value: 0 },
            { id: "b", time: 1, value: 1 },
          ],
        },
      ],
      [],
      2,
      "all",
    );
    const bezier = createGraphTrackPath(
      {
        points: [
          {
            easing: "bezier",
            handles: { x1: 0.25, x2: 0.75, y1: 0.1, y2: 0.9 },
            time: 0,
            value: 0,
          },
          { easing: "linear", time: 1, value: 1 },
        ],
      },
      viewport,
    );
    const hold = createGraphTrackPath(
      {
        points: [
          { easing: "hold", time: 0, value: 0 },
          { easing: "linear", time: 1, value: 1 },
        ],
      },
      viewport,
    );

    expect(bezier).toContain("C");
    expect(hold).toContain("H");
    expect(hold).toContain("V");
  });
});

function createTimeline() {
  return {
    duration: 4,
    phases: [],
    tracks: [
      {
        id: "opacity",
        label: "Opacity",
        layerId: "card",
        property: "opacity",
        keyframes: [
          {
            easing: "bezier",
            handles: { x1: 0.25, x2: 0.75, y1: 0.1, y2: 0.9 },
            id: "opacity-a",
            time: 1,
            value: 0,
          },
          {
            easing: "linear",
            handles: { x1: 0, x2: 1, y1: 0, y2: 1 },
            id: "opacity-b",
            time: 3,
            value: 1,
          },
        ],
      },
      {
        id: "scale",
        label: "Scale",
        layerId: "card",
        property: "scaleX",
        keyframes: [
          {
            easing: "linear",
            handles: { x1: 0, x2: 1, y1: 0, y2: 1 },
            id: "scale-a",
            time: 2,
            value: 1,
          },
          {
            easing: "linear",
            handles: { x1: 0, x2: 1, y1: 0, y2: 1 },
            id: "scale-b",
            time: 4,
            value: 2,
          },
        ],
      },
    ],
  };
}
