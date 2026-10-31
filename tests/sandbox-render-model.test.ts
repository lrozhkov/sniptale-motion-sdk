import { requiredEntry } from "./helpers/required-entry.js";
import { describe, expect, it, vi } from "vitest";

import {
  isLayerActive,
  normalizeClips,
  normalizeLayers,
  normalizeScenes,
  normalizeTimeline,
  resolveLayerState,
  resolvePhaseProgress,
  resolveScene,
  resolveTrackValue,
} from "../src/apps/sandbox/runtime/render-model";

describe("sandbox render model normalization", () => {
  it("resolves the active scene with deterministic fallback", () => {
    const scenes = [
      { duration: 1, id: "intro", start: 0 },
      { duration: 2, id: "main", start: 1 },
    ];

    expect(resolveScene(1.2, scenes)).toMatchObject({
      duration: 2,
      id: "main",
      start: 1,
    });
    expect(resolveScene(10, scenes)).toMatchObject({
      duration: 2,
      id: "main",
      start: 1,
    });
    expect(resolveScene(0, [])).toMatchObject({
      duration: 1,
      id: "main",
      start: 0,
    });
  });

  it("normalizes timeline phases, tracks, keyframes, and bezier handles", () => {
    const timeline = normalizeTimeline(
      {
        phases: [
          { duration: 0, id: "phase-a", label: 12, sceneId: 8, start: -5 },
          { id: "" },
          { duration: 3, id: "phase-b", sceneId: "scene", start: 99 },
        ],
        tracks: [
          {
            id: "layer-1.x",
            keyframes: [
              {
                easing: "bezier",
                handles: { x1: -1, x2: 2, y1: 0.4, y2: 9 },
                id: "late",
                time: 4,
                value: 20,
              },
              { id: "early", time: -2, value: 0 },
            ],
            layerId: "layer-1",
            property: "x",
            target: "layer",
          },
          { id: "" },
        ],
      },
      2,
    );

    expect(timeline.phases).toEqual([
      {
        duration: 0.001,
        enabled: true,
        id: "phase-a",
        label: "12",
        locked: false,
        sceneId: null,
        start: 0,
      },
      {
        duration: 3,
        enabled: true,
        id: "phase-b",
        label: "phase-b",
        locked: false,
        sceneId: "scene",
        start: 2,
      },
    ]);
    expect(timeline.tracks).toHaveLength(1);
    expect(requiredEntry(timeline.tracks, 0).keyframes).toEqual([
      {
        enabled: true,
        easing: "linear",
        handles: { x1: 0.25, x2: 0.25, y1: 0.1, y2: 1 },
        id: "early",
        phaseId: null,
        sceneId: null,
        time: 0,
        value: 0,
      },
      {
        enabled: true,
        easing: "bezier",
        handles: { x1: 0, x2: 1, y1: 0.4, y2: 1 },
        id: "late",
        phaseId: null,
        sceneId: null,
        time: 2,
        value: 20,
      },
    ]);
  });

  it("normalizes layers, path points, and clips", () => {
    expect(
      normalizeLayers([
        {
          anchorX: "4",
          id: "shape",
          opacity: "",
          pathClosed: "true",
          pathPoints: [
            { x: 3, y: -3 },
            { x: 0.5, y: 0.25 },
          ],
          width: "320",
          x: "12",
        },
        { id: "" },
      ]),
    ).toEqual([
      expect.objectContaining({
        anchorX: 4,
        id: "shape",
        opacity: 0,
        pathClosed: true,
        pathPoints: [
          { x: 2, y: -2 },
          { x: 0.5, y: 0.25 },
        ],
        type: "customDraw",
        visible: true,
        strokeWidth: 1,
        width: 320,
        x: 12,
      }),
    ]);

    expect(
      normalizeClips(
        [
          { duration: 0, layerId: "shape", offset: "0.5", start: -1 },
          { layerId: "" },
        ],
        3,
      ),
    ).toEqual([
      {
        duration: 3,
        enabled: true,
        layerId: "shape",
        locked: false,
        offset: 0.5,
        sceneId: null,
        start: 0,
      },
    ]);
  });

  it("keeps editor-only group nodes out of the renderer layer model", () => {
    expect(
      normalizeLayers([
        { id: "group-1", name: "Group 1", type: "group" },
        { id: "card", parentId: "group-1", type: "rect" },
      ]).map((layer) => layer.id),
    ).toEqual(["card"]);
  });
});

describe("sandbox render model resolver", () => {
  it("resolves paired x/y tracks through spatial tangents", () => {
    const timeline = normalizeTimeline(
      {
        motionPaths: [
          {
            layerId: "layer-1",
            points: [
              {
                kind: "corner",
                outTangent: { x: 100, y: 0 },
                xKeyframeId: "x-a",
                yKeyframeId: "y-a",
              },
              {
                inTangent: { x: 0, y: -100 },
                kind: "corner",
                xKeyframeId: "x-b",
                yKeyframeId: "y-b",
              },
            ],
          },
        ],
        tracks: [
          {
            id: "layer-1.x",
            keyframes: [
              { easing: "linear", id: "x-a", time: 0, value: 0 },
              { easing: "linear", id: "x-b", time: 1, value: 100 },
            ],
            layerId: "layer-1",
            property: "x",
          },
          {
            id: "layer-1.y",
            keyframes: [
              { easing: "linear", id: "y-a", time: 0, value: 0 },
              { easing: "linear", id: "y-b", time: 1, value: 100 },
            ],
            layerId: "layer-1",
            property: "y",
          },
        ],
      },
      1,
    );

    expect(resolveTrackValue(timeline, "layer-1.x", 0.5, -1)).toBe(87.5);
    expect(resolveTrackValue(timeline, "layer-1.y", 0.5, -1)).toBe(12.5);
  });

  it("resolves track values, phase progress, and active layer state", () => {
    const timeline = normalizeTimeline(
      {
        phases: [{ duration: 4, id: "phase-a", start: 1 }],
        tracks: [
          {
            id: "layer-1.x",
            keyframes: [
              { easing: "linear", time: 0, value: 0 },
              { easing: "linear", time: 10, value: 100 },
            ],
          },
          {
            id: "layer-1.opacity",
            keyframes: [
              { easing: "hold", time: 0, value: 0.25 },
              { easing: "hold", time: 10, value: 1 },
            ],
          },
        ],
      },
      10,
    );
    const layers = normalizeLayers([{ id: "layer-1", opacity: 0.5, y: 7 }]);
    const clips = normalizeClips(
      [{ duration: 4, layerId: "layer-1", offset: 2, start: 2 }],
      10,
    );

    expect(resolveTrackValue(timeline, "layer-1.x", 5, -1)).toBe(50);
    expect(resolveTrackValue(timeline, "missing", 5, -1)).toBe(-1);
    expect(resolvePhaseProgress(timeline, "phase-a", 3)).toBe(0.5);
    expect(resolvePhaseProgress(timeline, "missing", 3)).toBe(0);
    expect(isLayerActive(clips, "layer-1", 1)).toBe(false);
    expect(isLayerActive(clips, "layer-1", 3)).toBe(true);

    expect(resolveLayerState(layers, clips, timeline, "layer-1", 3)).toEqual(
      expect.objectContaining({
        active: true,
        clipProgress: 0.25,
        localTime: 3,
        opacity: 0.25,
        x: 30,
        y: 7,
      }),
    );
  });

  it("keeps track lookup sublinear without changing duplicate-time semantics", () => {
    let timeReads = 0;
    const keyframes = Array.from({ length: 4096 }, (_, index) => ({
      easing: "linear",
      id: `key-${index}`,
      get time() {
        timeReads += 1;
        return index;
      },
      value: index,
    }));
    const timeline = {
      phases: [],
      scenes: [],
      tracks: [{ id: "dense.x", keyframes }],
    };

    expect(resolveTrackValue(timeline, "dense.x", 3072.5, -1)).toBe(3072.5);
    expect(timeReads).toBeLessThan(40);

    const duplicateTimeline = normalizeTimeline(
      {
        tracks: [
          {
            id: "duplicate.x",
            keyframes: [
              { time: 0, value: 0 },
              { time: 2, value: 20 },
              { time: 2, value: 30 },
              { time: 4, value: 40 },
            ],
          },
        ],
      },
      4,
    );
    expect(resolveTrackValue(duplicateTimeline, "duplicate.x", 2, -1)).toBe(20);
    expect(
      resolveTrackValue(duplicateTimeline, "duplicate.x", 2.001, -1),
    ).toBeCloseTo(30.005, 6);
  });

  it("preserves enabled flags and skips disabled runtime items", () => {
    const scenes = [
      { duration: 2, enabled: false, id: "disabled-scene", start: 0 },
      { duration: 2, id: "main", start: 2 },
    ];
    const timeline = normalizeTimeline(
      {
        phases: [
          { duration: 2, enabled: false, id: "muted-phase", start: 0 },
          {
            duration: 2,
            id: "scene-phase",
            sceneId: "disabled-scene",
            start: 0,
          },
        ],
        tracks: [
          {
            enabled: false,
            id: "layer-1.x",
            keyframes: [{ time: 0, value: 100 }],
          },
          {
            id: "layer-1.opacity",
            keyframes: [
              { enabled: false, time: 0, value: 0 },
              { time: 1, value: 1 },
            ],
            phaseId: "muted-phase",
          },
          {
            id: "layer-1.y",
            keyframes: [{ time: 0, value: 12 }],
            sceneId: "disabled-scene",
          },
        ],
      },
      4,
      scenes,
    );
    const clips = normalizeClips(
      [
        { duration: 2, enabled: false, layerId: "layer-1", start: 0 },
        {
          duration: 2,
          layerId: "layer-2",
          sceneId: "disabled-scene",
          start: 0,
        },
      ],
      4,
    );

    expect(resolveScene(0.5, scenes).id).toBe("main");
    expect(isLayerActive(clips, "layer-1", 1, scenes)).toBe(false);
    expect(isLayerActive(clips, "layer-2", 1, scenes)).toBe(false);
    expect(resolvePhaseProgress(timeline, "muted-phase", 1)).toBe(0);
    expect(resolvePhaseProgress(timeline, "scene-phase", 1)).toBe(0);
    expect(resolveTrackValue(timeline, "layer-1.x", 1, -1)).toBe(-1);
    expect(resolveTrackValue(timeline, "layer-1.opacity", 1, 0.25)).toBe(0.25);
    expect(resolveTrackValue(timeline, "layer-1.y", 1, -1)).toBe(-1);
  });
});

it("keeps scene locale maps instead of coercing them to object text", () => {
  const labels = { ru: "Вступление", en: "Intro" };
  const scenes = normalizeScenes(
    [{ id: "intro", label: labels, start: 0, duration: 1 }],
    1,
  );
  expect(scenes[0]?.label).toEqual(labels);
});

it("does not invoke unknown metadata conversion hooks while normalizing a model", () => {
  const convert = vi.fn(() => 1);
  const value = { toString: convert, valueOf: convert };
  expect(normalizeLayers([{ id: value, width: value, height: value }])).toEqual(
    [],
  );
  const scenes = normalizeScenes(
    [{ id: "scene", label: value, start: value, duration: value }],
    1,
  );
  expect(scenes[0]).toMatchObject({
    id: "scene",
    label: "",
    start: 0,
    duration: 1,
  });
  expect(convert).not.toHaveBeenCalled();
});
