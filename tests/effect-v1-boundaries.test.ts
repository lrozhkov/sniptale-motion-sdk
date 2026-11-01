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

  it.each(cases([null, false, true, "0", "1", [], {}, NaN, Infinity]))(
    "rejects non-numeric timing without coercion: %j",
    ({ value }) => {
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

describe("Effect v1 reference receiving boundaries", () => {
  it.each(
    cases([true, false, 1, null, ["true"], {}, { toString: null }, "missing"]),
  )("rejects malformed and undeclared references: %j", ({ value }) => {
    const paths = [
      ["track", "target", "TRACK_LAYER_UNKNOWN", "$.timeline.tracks[0].target"],
      ["clip", "layerId", "CLIP_LAYER_UNKNOWN", "$.clips[0].layerId"],
      ["clip", "sceneId", "CLIP_SCENE_UNKNOWN", "$.clips[0].sceneId"],
      [
        "phase",
        "sceneId",
        "PHASE_SCENE_UNKNOWN",
        "$.timeline.phases[0].sceneId",
      ],
      [
        "track",
        "layerId",
        "TRACK_LAYER_UNKNOWN",
        "$.timeline.tracks[0].layerId",
      ],
      [
        "track",
        "sceneId",
        "TRACK_SCENE_UNKNOWN",
        "$.timeline.tracks[0].sceneId",
      ],
      [
        "track",
        "phaseId",
        "TRACK_PHASE_UNKNOWN",
        "$.timeline.tracks[0].phaseId",
      ],
      [
        "keyframe",
        "sceneId",
        "KEYFRAME_SCENE_UNKNOWN",
        "$.timeline.tracks[0].keyframes[0].sceneId",
      ],
      [
        "keyframe",
        "phaseId",
        "KEYFRAME_PHASE_UNKNOWN",
        "$.timeline.tracks[0].keyframes[0].phaseId",
      ],
      [
        "command",
        "layerId",
        "COMMAND_LAYER_UNKNOWN",
        "$.program.commands[0].layerId",
      ],
    ] as const;
    for (const [owner, field, code, path] of paths) {
      const input = document();
      const targets = {
        clip: input.clips[0],
        phase: input.timeline.phases[0],
        track: input.timeline.tracks[0],
        keyframe: input.timeline.tracks[0]?.keyframes[0],
        command: input.program.commands[0],
      };
      const target = targets[owner];
      if (!target) throw new Error("Reference boundary fixture has no target");
      Object.assign(target, { [field]: value });
      const result = validateEffectV1Document(input);
      expect({ path, ok: result.ok }).toEqual({ path, ok: false });
      expect(result.document).toBeUndefined();
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code, path }),
      );
    }
  });
});

describe("Effect v1 asset and hierarchy reference boundaries", () => {
  it.each(cases([false, null, 1, {}]))(
    "rejects a second image source even when its value is invalid: %j",
    ({ value: inputValue }) => {
      const input = assetDocument();
      const command = input.program.commands[0];
      if (!command) throw new Error("Asset fixture has no command");
      Object.assign(command, { op: "image" });
      expect(validateEffectV1Document(input).ok).toBe(true);
      Object.assign(command, { input: inputValue });
      const result = validateEffectV1Document(input);
      expect(result.ok).toBe(false);
      expect(result.document).toBeUndefined();
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "IMAGE_SOURCE",
          path: "$.program.commands[0]",
        }),
      );
    },
  );

  it.each(cases([true, ["true"], null, {}, 1]))(
    "rejects non-string asset references: %j",
    ({ value }) => {
      for (const owner of ["layer", "command"] as const) {
        const input = assetDocument();
        expect(validateEffectV1Document(input).ok).toBe(true);
        const target =
          owner === "layer" ? input.layers[0] : input.program.commands[0];
        if (!target) throw new Error("Asset fixture has no reference owner");
        Object.assign(target, { assetId: value });
        const result = validateEffectV1Document(input);
        expect(result.ok).toBe(false);
        expect(result.document).toBeUndefined();
        expect(result.diagnostics).toContainEqual(
          expect.objectContaining({
            code:
              owner === "layer"
                ? "LAYER_ASSET_UNKNOWN"
                : "COMMAND_ASSET_UNKNOWN",
            path:
              owner === "layer"
                ? "$.layers[0].assetId"
                : "$.program.commands[0].assetId",
          }),
        );
      }
    },
  );

  it.each(cases([true, false, ["parent"], {}, 1]))(
    "rejects non-string group parents: %j",
    ({ value }) => {
      const source = document();
      const input = {
        ...source,
        layers: [
          { id: "parent", type: "group" },
          ...source.layers.map((layer) => ({ ...layer, parentId: "parent" })),
        ],
      };
      expect(validateEffectV1Document(input).ok).toBe(true);
      const child = input.layers[1];
      if (!child) throw new Error("Group fixture has no child");
      Object.assign(child, { parentId: value });
      const result = validateEffectV1Document(input);
      expect(result.ok).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "LAYER_PARENT_UNKNOWN",
          path: "$.layers[1].parentId",
        }),
      );
    },
  );

  it.each([null, undefined])("preserves unparented layers: %j", (parentId) => {
    const input = document();
    const layer = input.layers[0];
    if (!layer) throw new Error("Fixture has no layer");
    Object.assign(layer, { parentId });
    expect(validateEffectV1Document(input).ok).toBe(true);
  });
});

describe("Effect v1 enum receiving boundaries", () => {
  it.each(cases([true, ["point"], { toString: null }]))(
    "rejects a coerced sample variable name: %j",
    ({ value: sampleVar }) => {
      const source = document();
      const sampled = {
        op: "sampledPath",
        from: 0,
        to: 1,
        samples: 2,
        x: 0,
        y: 0,
        stroke: "#fff",
        sampleVar: "point",
      };
      const input = {
        ...source,
        program: {
          ...source.program,
          commands: [...source.program.commands, sampled],
        },
      };
      expect(validateEffectV1Document(input).ok).toBe(true);
      Object.assign(sampled, { sampleVar });
      expect(validateEffectV1Document(input).diagnostics).toContainEqual(
        expect.objectContaining({
          code: "SAMPLED_PATH_VARIABLE",
          path: "$.program.commands[1].sampleVar",
        }),
      );
    },
  );

  it("rejects a coerced shape name", () => {
    const input = document();
    const command = input.program.commands[0];
    if (!command) throw new Error("Fixture has no shape command");
    Object.assign(command, { shape: ["rect"] });
    expect(validateEffectV1Document(input).diagnostics).toContainEqual(
      expect.objectContaining({
        code: "COMMAND_ENUM",
        path: "$.program.commands[0].shape",
      }),
    );
  });

  it("rejects a coerced asset kind", () => {
    const input = assetDocument();
    const asset = input.assets[0];
    if (!asset) throw new Error("Fixture has no asset");
    Object.assign(asset, { kind: ["svg"] });
    const result = validateEffectV1Document(input);
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "ASSET_KIND", path: "$.assets[0].kind" }),
    );
  });

  it("rejects a coerced control kind", () => {
    const source = document();
    const input = {
      ...source,
      controls: [
        { id: "amount", kind: "number", defaultValue: 1, min: 0, max: 2 },
      ],
      program: {
        ...source.program,
        commands: source.program.commands.map((command) => ({
          ...command,
          width: { op: "read", path: "controls.amount" },
        })),
      },
    };
    expect(validateEffectV1Document(input).ok).toBe(true);
    const control = input.controls[0];
    if (!control) throw new Error("Fixture has no control");
    Object.assign(control, { kind: ["number"] });
    expect(validateEffectV1Document(input).diagnostics).toContainEqual(
      expect.objectContaining({
        code: "CONTROL_KIND",
        path: "$.controls[0].kind",
      }),
    );
  });

  it.each(["layer", "kind"] as const)(
    "rejects a coerced motion path %s",
    (field) => {
      const source = document();
      const x = source.timeline.tracks[0];
      if (!x) throw new Error("Fixture has no x track");
      const y = {
        ...x,
        id: "true.y",
        property: "y",
        keyframes: [{ ...frame(), id: "y" }],
      };
      const point = { xKeyframeId: "x", yKeyframeId: "y", kind: "linear" };
      const path = { layerId: "true", points: [point] };
      const input = {
        ...source,
        timeline: { ...source.timeline, tracks: [x, y], motionPaths: [path] },
      };
      expect(validateEffectV1Document(input).ok).toBe(true);
      if (field === "layer") Object.assign(path, { layerId: true });
      else Object.assign(point, { kind: ["linear"] });
      const result = validateEffectV1Document(input);
      expect(result.ok).toBe(false);
      expect(result.document).toBeUndefined();
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code:
            field === "layer"
              ? "MOTION_PATH_LAYER_UNKNOWN"
              : "MOTION_POINT_KIND",
          path:
            field === "layer"
              ? "$.timeline.motionPaths[0].layerId"
              : "$.timeline.motionPaths[0].points[0].kind",
        }),
      );
    },
  );
});

describe("Effect v1 diagnostics for malformed JSON objects", () => {
  const malformed = { toString: null, valueOf: null };

  it("reports an invalid root duration without object coercion", () => {
    const input = { ...document(), duration: malformed };
    const result = validateEffectV1Document(input);
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "POSITIVE_NUMBER", path: "$.duration" }),
    );
  });

  it("reports an invalid command operation without object coercion", () => {
    const input = document();
    const command = input.program.commands[0];
    if (!command) throw new Error("Fixture has no command");
    Object.assign(command, { op: malformed });
    expect(validateEffectV1Document(input).diagnostics).toContainEqual(
      expect.objectContaining({
        code: "COMMAND_OP",
        path: "$.program.commands[0].op",
      }),
    );
  });

  it("reports an invalid expression operation without object coercion", () => {
    const source = document();
    const input = {
      ...source,
      program: { ...source.program, definitions: { bad: { op: malformed } } },
    };
    expect(validateEffectV1Document(input).diagnostics).toContainEqual(
      expect.objectContaining({
        code: "EXPRESSION_OP",
        path: "$.program.definitions.bad.op",
      }),
    );
  });

  it.each(cases([malformed, "constructor", "__proto__", ["moveTo"]]))(
    "reports an invalid path segment kind: %j",
    ({ value: kind }) => {
      const source = document();
      const input = {
        ...source,
        program: {
          kind: "graph",
          version: 1,
          commands: [
            {
              op: "path",
              layerId: "true",
              stroke: "#fff",
              segments: [{ kind: "moveTo", x: 0, y: 0 }],
            },
          ],
        },
      };
      expect(validateEffectV1Document(input).ok).toBe(true);
      const segment = input.program.commands[0]?.segments[0];
      if (!segment) throw new Error("Fixture has no path segment");
      Object.assign(segment, { kind });
      expect(validateEffectV1Document(input).diagnostics).toContainEqual(
        expect.objectContaining({
          code: "COMMAND_PATH_SEGMENT_KIND",
          path: "$.program.commands[0].segments[0].kind",
        }),
      );
    },
  );

  it("reports malformed loop bounds without object coercion", () => {
    const source = document();
    const input = {
      ...source,
      program: {
        ...source.program,
        commands: [
          {
            op: "forRange",
            count: malformed,
            commands: source.program.commands,
          },
        ],
      },
    };
    expect(validateEffectV1Document(input).diagnostics).toContainEqual(
      expect.objectContaining({
        code: "LOOP_BOUND",
        path: "$.program.commands[0].count",
      }),
    );
  });
});

function assetDocument() {
  return {
    ...document(),
    assets: [
      {
        id: "true",
        kind: "svg",
        mimeType: "image/svg+xml",
        path: "assets/icon.svg",
        width: 40,
        height: 40,
      },
    ],
    layers: [
      { id: "true", type: "svgAsset", assetId: "true", width: 40, height: 40 },
    ],
    program: {
      kind: "graph",
      version: 1,
      commands: [
        {
          op: "svgParts",
          layerId: "true",
          assetId: "true",
          width: 40,
          height: 40,
          x: 0,
          y: 0,
        },
      ],
    },
  };
}

function document() {
  return {
    schemaVersion: EFFECT_V1_SCHEMA,
    id: "numeric-boundary",
    kind: "standalone",
    duration: 2,
    label: { ru: "Границы чисел", en: "Numeric boundaries" },
    assets: [],
    controls: [],
    layers: [{ id: "true", type: "rect", width: 40, height: 40 }],
    clips: [{ layerId: "true", sceneId: "true", ...timing() }],
    scenes: [{ id: "true", ...timing() }],
    timeline: {
      phases: [{ id: "true", sceneId: "true", ...timing() }],
      tracks: [
        {
          id: "true.x",
          layerId: "true",
          property: "x",
          phaseId: "true",
          sceneId: "true",
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
          layerId: "true",
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
  return { id: "x", time, value: 10, sceneId: "true", phaseId: "true" };
}

function cases(values: readonly unknown[]): { value: unknown }[] {
  return values.map((value) => ({ value }));
}
