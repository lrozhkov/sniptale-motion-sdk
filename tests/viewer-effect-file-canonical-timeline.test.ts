import { describe, expect, it } from "vitest";
import { createNeutralEffectV1Document } from "../tooling/test/fixtures/effect-v1-documents.js";
import { normalizeTimeline } from "../src/apps/viewer/editor/model.js";
import {
  buildEffectFileTimeline,
  buildEffectFilePayload,
} from "../src/apps/viewer/effect-file/builder.js";
import {
  normalizeEffectV1ToTemplate,
  validateEffectV1Document,
} from "../src/sdk/effect-v1/index.js";

describe("canonical timeline export after editing", () => {
  it("exports normalized editor absence markers without changing editor state", () => {
    const source = document();
    expect(validateEffectV1Document(source).ok).toBe(true);
    const timeline = normalizeTimeline(source.timeline, source.duration);
    const before = JSON.stringify(timeline);
    const exported = buildEffectFileTimeline(timeline);
    const result = validateEffectV1Document({ ...source, timeline: exported });
    expect(result).toMatchObject({ ok: true, summary: { errors: 0 } });
    expect(JSON.stringify(timeline)).toBe(before);
    expect(exported).not.toHaveProperty("duration");
    expect(result.document?.timeline.tracks[0]).not.toHaveProperty("sceneId");
    expect(result.document?.timeline.tracks[0]).not.toHaveProperty("target");
  });

  it("preserves actual links and keyframe values", () => {
    const source = document();
    const timeline = normalizeTimeline(source.timeline, source.duration);
    const phase = timeline.phases[0];
    const track = timeline.tracks[0];
    const keyframe = track?.keyframes[0];
    if (!phase || !track || !keyframe)
      throw new Error("Fixture has no linked timing");
    phase.sceneId = "main";
    track.sceneId = "main";
    keyframe.phaseId = "intro";
    keyframe.sceneId = "main";
    keyframe.value = null;
    const result = validateEffectV1Document({
      ...source,
      timeline: buildEffectFileTimeline(timeline),
    });
    expect(result.ok).toBe(true);
    expect(result.document?.timeline.tracks[0]?.keyframes[0]).toMatchObject({
      phaseId: "intro",
      sceneId: "main",
      value: null,
    });
  });

  it("preserves malformed references for rejection instead of repairing them", () => {
    const source = document();
    const timeline = normalizeTimeline(source.timeline, source.duration);
    const corrupted = {
      ...timeline,
      tracks: timeline.tracks.map((track) => ({
        ...track,
        sceneId: { id: "main" },
      })),
    };
    const result = validateEffectV1Document({
      ...source,
      timeline: buildEffectFileTimeline(corrupted),
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "TRACK_SCENE_UNKNOWN",
        path: "$.timeline.tracks[0].sceneId",
      }),
    );
  });

  it("exports a cleared optional clip scene as absence", () => {
    const source = document();
    const template = {
      ...normalizeEffectV1ToTemplate(source),
      timeline: normalizeTimeline(source.timeline, source.duration),
      clips: [{ layerId: "card", start: 0, duration: 2, sceneId: null }],
    };
    const result = validateEffectV1Document(
      buildEffectFilePayload({ assets: new Map<string, never>(), template }),
    );
    expect(result.ok).toBe(true);
    expect(result.document?.clips[0]).not.toHaveProperty("sceneId");
  });
});

function document() {
  const source = createNeutralEffectV1Document("standalone");
  source.layers = [{ id: "card", type: "rect", width: 40, height: 40 }];
  source.program.commands = [
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
  ];
  source.timeline = {
    phases: [{ id: "intro", start: 0, duration: 2 }],
    tracks: [
      {
        id: "card.x",
        layerId: "card",
        property: "x",
        phaseId: "intro",
        keyframes: [{ id: "x", time: 0, value: 0 }],
      },
    ],
  };
  return source;
}
