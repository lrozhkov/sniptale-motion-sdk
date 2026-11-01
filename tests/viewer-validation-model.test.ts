import { describe, expect, it } from "vitest";

import {
  collectEditorValidationErrors,
  collectEditorValidationIssues,
  hasInvalidTiming,
} from "../src/apps/viewer/validation/model";

describe("viewer validation model", () => {
  it("reports missing references and unsafe assets", () => {
    const issues = collectEditorValidationIssues(
      {
        assets: ["asset-logo"],
        clips: [{ duration: 1, layerId: "missing-layer", start: 0 }],
        duration: 2,
        layers: [
          {
            assetId: "missing-asset",
            id: "logo",
            type: "svgAsset",
          },
        ],
        scenes: [],
        timeline: { phases: [], tracks: [] },
      },
      {
        assets: new Map([
          ["asset-logo", { id: "asset-logo", path: "../escape.svg" }],
        ]),
        isSafeLocalAssetPath: (path) =>
          path === null ||
          path === undefined ||
          (typeof path === "string" && !path.includes("..")),
        isSafeSvgAssetText: () => true,
      },
    );

    expect(issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        'Layer "logo" references missing asset "missing-asset"',
        'Clip references missing layer "missing-layer"',
        'Asset "asset-logo" has unsafe local path "../escape.svg"',
      ]),
    );
    expect(issues.every((issue) => Boolean(issue.messageKey))).toBe(true);
  });

  it("detects timing errors across phases and keyframes", () => {
    const template = {
      clips: [],
      duration: 2,
      layers: [{ id: "layer-a", type: "text" }],
      scenes: [{ duration: 1, id: "intro", start: 0 }],
      timeline: {
        phases: [
          {
            duration: 1,
            id: "phase-a",
            sceneId: "intro",
            start: 1.5,
          },
        ],
        tracks: [
          {
            id: "track-a",
            keyframes: [{ id: "key-a", phaseId: "phase-a", time: 0.2 }],
            layerId: "layer-a",
          },
        ],
      },
    };

    expect(hasInvalidTiming(template)).toBe(true);
    expect(collectEditorValidationErrors(template)).toEqual(
      expect.arrayContaining([
        'Phase "phase-a" is outside scene "intro"',
        'Keyframe "key-a" in "track-a" is outside phase "phase-a"',
      ]),
    );
  });

  it("allows shared keyframe-level phases across layer tracks", () => {
    const template = {
      clips: [],
      duration: 4,
      layers: [
        { id: "orbit", type: "customDraw" },
        { id: "background", type: "customDraw" },
      ],
      scenes: [{ duration: 4, id: "main", start: 0 }],
      timeline: {
        phases: [
          {
            duration: 1,
            id: "out",
            sceneId: "main",
            start: 2,
          },
        ],
        tracks: [
          {
            id: "orbit.progress",
            keyframes: [{ id: "orbit-out", phaseId: "out", time: 2.4 }],
            target: "orbit",
          },
          {
            id: "background.opacity",
            keyframes: [{ id: "background-out", phaseId: "out", time: 2.7 }],
            target: "background",
          },
        ],
      },
    };

    expect(collectEditorValidationErrors(template)).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'references phase "out" owned by another layer',
        ),
      ]),
    );
  });

  it("reports composition visual layers that are not renderer-gated", () => {
    const template = {
      clips: [{ duration: 2, layerId: "title", sceneId: "main", start: 0 }],
      duration: 2,
      kind: "composition",
      layers: [{ id: "title", type: "text" }],
      scenes: [{ duration: 2, id: "main", start: 0 }],
      timeline: {
        phases: [{ duration: 1, id: "in", sceneId: "main", start: 0 }],
        tracks: [
          {
            id: "title.opacity",
            keyframes: [
              { id: "title-opacity-a", phaseId: "in", time: 0, value: 0 },
              { id: "title-opacity-b", phaseId: "in", time: 1, value: 1 },
            ],
            phaseId: "in",
            target: "title",
          },
        ],
      },
    };

    const issues = collectEditorValidationIssues(template, {
      rendererCoverage: {
        clips: [],
        controls: [],
        inputFrames: [],
        layerGateReads: [],
        layers: [],
        primitivePaintReads: [],
        phases: ["in"],
        tracks: ["title.opacity"],
      },
    });

    expect(issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        'Renderer contract violation: visual layer "title" is not gated with resolveLayer/isLayerActive',
        'Renderer contract violation: clip for layer "title" is not gated with resolveLayer/isLayerActive',
        'Renderer contract violation: track "title.opacity" is read without gating layer "title"',
      ]),
    );
    expect(
      issues.filter((issue) => issue.category === "Contract"),
    ).toHaveLength(3);
  });

  it("accepts gated composition visual layers in renderer coverage", () => {
    const template = {
      clips: [{ duration: 2, layerId: "title", sceneId: "main", start: 0 }],
      duration: 2,
      kind: "composition",
      layers: [{ id: "title", type: "text" }],
      scenes: [{ duration: 2, id: "main", start: 0 }],
      timeline: {
        phases: [],
        tracks: [{ id: "title.opacity", keyframes: [], target: "title" }],
      },
    };

    expect(
      collectEditorValidationErrors(template, {
        rendererCoverage: {
          clips: ["title"],
          controls: [],
          inputFrames: [],
          layerGateReads: ["title"],
          layers: ["title"],
          primitivePaintReads: ["title"],
          phases: [],
          tracks: ["title.opacity"],
        },
      }),
    ).toEqual([]);
  });

  it("rejects exposed controls, phases, and tracks that renderer never reads", () => {
    const template = {
      clips: [{ duration: 2, layerId: "title", sceneId: "main", start: 0 }],
      controls: [{ id: "accent", kind: "color" }],
      duration: 2,
      kind: "composition",
      layers: [{ id: "title", type: "text" }],
      scenes: [{ duration: 2, id: "main", start: 0 }],
      timeline: {
        phases: [{ duration: 2, id: "intro", sceneId: "main", start: 0 }],
        tracks: [
          {
            id: "title.opacity",
            keyframes: [],
            phaseId: "intro",
            target: "title",
          },
        ],
      },
    };

    const issues = collectEditorValidationIssues(template, {
      rendererCoverage: {
        clips: ["title"],
        controls: [],
        inputFrames: [],
        layerGateReads: ["title"],
        layers: ["title"],
        phases: [],
        primitivePaintReads: ["title"],
        tracks: [],
      },
    });

    expect(issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        'Renderer contract violation: control "accent" is not read',
        'Renderer contract violation: phase "intro" is not read',
        'Renderer contract violation: track "title.opacity" is not read',
      ]),
    );
    expect(issues.every((issue) => issue.category === "Contract")).toBe(true);
  });

  it("does not require renderer gates for audio timeline layers", () => {
    const template = {
      clips: [
        { duration: 2, layerId: "soundscape", sceneId: "main", start: 0 },
      ],
      duration: 2,
      kind: "composition",
      layers: [{ assetId: "asset-sound", id: "soundscape", type: "audio" }],
      scenes: [{ duration: 2, id: "main", start: 0 }],
      timeline: {
        phases: [],
        tracks: [],
      },
    };

    expect(
      collectEditorValidationErrors(template, {
        rendererCoverage: {
          clips: [],
          controls: [],
          inputFrames: [],
          layerGateReads: [],
          layers: [],
          primitivePaintReads: [],
          phases: [],
          tracks: [],
        },
      }),
    ).toEqual([]);
  });

  it("treats target scene tracks as scene/global tracks, not missing layers", () => {
    const template = {
      clips: [],
      duration: 2,
      kind: "composition",
      layers: [{ id: "title", type: "text" }],
      scenes: [{ duration: 2, id: "main", start: 0 }],
      timeline: {
        phases: [
          {
            duration: 2,
            id: "pulse",
            label: "Pulse",
            sceneId: "main",
            start: 0,
          },
        ],
        tracks: [
          {
            id: "scene.glow",
            keyframes: [
              { id: "scene-glow-a", phaseId: "pulse", time: 0, value: 1 },
            ],
            label: "Scene glow",
            phaseId: "pulse",
            property: "glow",
            target: "scene",
          },
        ],
      },
    };

    expect(collectEditorValidationErrors(template)).not.toEqual(
      expect.arrayContaining([
        'Track "scene.glow" references missing layer "scene"',
      ]),
    );
  });
});
