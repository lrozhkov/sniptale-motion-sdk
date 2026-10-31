import { describe, expect, it } from "vitest";
import {
  validateEffectV1Document,
  EFFECT_V1_SCHEMA,
} from "../src/sdk/effect-v1/index.js";

describe("Effect v1 numeric receiving boundaries", () => {
  it("accepts the matching numeric document", () => {
    expect(validateEffectV1Document(document())).toMatchObject({
      ok: true,
      summary: { errors: 0 },
    });
  });

  it.each([null, false, true, "0", "1", [], {}, NaN, Infinity])(
    "rejects non-numeric timing without coercion: %j",
    (value: unknown) => {
      for (const owner of ["scene", "clip", "phase"] as const) {
        for (const field of ["start", "duration"] as const) {
          const input = document();
          const range =
            owner === "scene"
              ? input.scenes[0]
              : owner === "clip"
                ? input.clips[0]
                : input.timeline.phases[0];
          if (!range) throw new Error("Numeric boundary fixture has no range");
          range[field] = value;
          const path =
            owner === "phase"
              ? "$.timeline.phases[0]"
              : owner === "scene"
                ? "$.scenes[0]"
                : "$.clips[0]";
          const result = validateEffectV1Document(input);
          expect(result.ok, `${owner}.${field}`).toBe(false);
          expect(result.document).toBeUndefined();
          expect(result.diagnostics).toContainEqual(
            expect.objectContaining({
              code: field === "start" ? "RANGE_START" : "RANGE_DURATION",
              path: `${path}.${field}`,
            }),
          );
        }
      }
      const input = document();
      const keyframe = input.timeline.tracks[0]?.keyframes[0];
      if (!keyframe)
        throw new Error("Numeric boundary fixture has no keyframe");
      keyframe.time = value;
      const result = validateEffectV1Document(input);
      expect(result.ok).toBe(false);
      expect(result.document).toBeUndefined();
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "KEYFRAME_TIME",
          path: "$.timeline.tracks[0].keyframes[0].time",
        }),
      );
    },
  );
});

function document() {
  return {
    schemaVersion: EFFECT_V1_SCHEMA,
    id: "numeric-boundary",
    kind: "standalone",
    duration: 2,
    label: { ru: "Границы чисел", en: "Numeric boundaries" },
    assets: [],
    controls: [],
    layers: [{ id: "card", type: "rect", width: 40, height: 40 }],
    clips: [{ layerId: "card", sceneId: "main", ...timing() }],
    scenes: [{ id: "main", ...timing() }],
    timeline: {
      phases: [{ id: "intro", ...timing() }],
      tracks: [
        {
          id: "card.x",
          layerId: "card",
          property: "x",
          phaseId: "intro",
          keyframes: [frame()],
        },
      ],
    },
    program: {
      kind: "graph",
      version: 1,
      commands: [
        {
          op: "shape",
          layerId: "card",
          shape: "rect",
          fill: "#fff",
          width: 40,
          height: 40,
          x: 0,
          y: 0,
        },
      ],
    },
  };
}

function timing(): { start: unknown; duration: unknown } {
  return { start: 0, duration: 2 };
}
function frame(time: unknown = 0) {
  return { id: "x", time, value: 10 };
}
