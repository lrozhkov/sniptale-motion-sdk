import { describe, expect, expectTypeOf, it } from "vitest";
import type { ViewerAppContext } from "../src/apps/viewer/app/context.js";
import type { EditorTimeline } from "../src/apps/viewer/editor/model-types.js";
import { readEditorTimeline } from "../src/apps/viewer/editor/timeline-source.js";

function timeline() {
  return {
    duration: 0.02,
    extension: { source: "keep" },
    phases: [
      { id: "intro", start: 0.001, duration: 0.019, extension: "phase" },
    ],
    tracks: [
      {
        id: "title.x",
        layerId: null,
        sceneId: null,
        keyframes: [
          {
            id: "later",
            time: 0.019,
            value: { arbitrary: [true, "x"] },
            extension: "keyframe",
          },
          { id: "first", time: 0.001, value: false },
        ],
      },
    ],
    motionPaths: [
      { layerId: "title", points: [{ xKeyframeId: "x", yKeyframeId: "y" }] },
    ],
  };
}

describe("editor timeline source boundary", () => {
  it("exposes a typed timeline with opaque keyframe values through the app context", () => {
    expectTypeOf<
      ReturnType<ViewerAppContext["getEffectiveTimeline"]>
    >().toEqualTypeOf<EditorTimeline>();
    expectTypeOf<
      EditorTimeline["tracks"][number]["keyframes"][number]["value"]
    >().toBeUnknown();
  });
  it("preserves short timing, order, unknown values and extensions without normalizing source motion points", () => {
    const source = timeline();
    const before = structuredClone(source);
    const parsed = readEditorTimeline(source, source.duration);
    expect(parsed).toEqual(before);
    expect(source).toEqual(before);
    expect(parsed.tracks[0]?.keyframes.map((key) => key.id)).toEqual([
      "later",
      "first",
    ]);
    expect(parsed.motionPaths?.[0]?.points[0]).not.toHaveProperty("inTangent");
  });

  it("uses the effective duration without clamping phase or keyframe times", () => {
    const parsed = readEditorTimeline(timeline(), 0.01);
    expect(parsed.duration).toBe(0.01);
    expect(parsed.phases[0]?.duration).toBe(0.019);
    expect(parsed.tracks[0]?.keyframes[0]?.time).toBe(0.019);
  });

  it("provides empty lists for a timeline without phases and tracks", () => {
    expect(readEditorTimeline({ extension: 1 }, 3)).toEqual({
      duration: 3,
      extension: 1,
      phases: [],
      tracks: [],
    });
  });

  it.each([
    null,
    false,
    [],
    "timeline",
    { phases: [null] },
    { phases: [{ id: "p", start: "0", duration: 1 }] },
    { phases: [{ id: "p", start: 0, duration: 1, locked: 1 }] },
    { tracks: [{ id: "t", keyframes: "keys" }] },
    { tracks: [{ id: "t", keyframes: [null] }] },
    { tracks: [{ id: "t", keyframes: [{ id: "k", time: 0 }] }] },
    {
      tracks: [
        { id: "t", keyframes: [{ id: "k", time: 0, value: 1, easing: [] }] },
      ],
    },
    {
      tracks: [
        {
          id: "t",
          keyframes: [{ id: "k", time: 0, value: 1, handles: { x1: 0 } }],
        },
      ],
    },
    { tracks: [{ id: "t", keyframes: [], layerId: {} }] },
    {
      motionPaths: [
        {
          layerId: "l",
          points: [{ xKeyframeId: "x", yKeyframeId: "y", kind: "script" }],
        },
      ],
    },
    {
      motionPaths: [
        {
          layerId: "l",
          points: [
            {
              xKeyframeId: "x",
              yKeyframeId: "y",
              inTangent: { x: null, y: 0 },
            },
          ],
        },
      ],
    },
  ])("rejects malformed known fields: %j", (source) => {
    expect(() => readEditorTimeline(source, 1)).toThrow(/Invalid editor/);
  });

  it.each([NaN, Infinity, -Infinity])(
    "rejects a non-finite effective duration %s",
    (duration) => {
      expect(() => readEditorTimeline(timeline(), duration)).toThrow(
        /Invalid editor/,
      );
    },
  );
});
