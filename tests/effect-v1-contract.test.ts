import { requiredEntry } from "./helpers/required-entry.js";
import {
  responseObject,
  responseString,
} from "../tooling/test/fixtures/response.js";
import type {
  EffectV1Document,
  EffectV1Diagnostic,
} from "../src/sdk/effect-v1/types.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  EFFECT_V1_JSON_SCHEMA,
  EFFECT_V1_COMMAND_OPS,
  EFFECT_V1_EXPRESSION_OPS,
  EFFECT_V1_SCHEMA,
  normalizeEffectV1ToTemplate,
  parseEffectV1Source,
  resolveEffectV1InputContract,
  validateEffectV1Document,
} from "../src/sdk/effect-v1";

describe("Effect v1 contract", () => {
  it("publishes literal traversal checks without rejecting normal two-character paths", () => {
    const path = new RegExp(
      EFFECT_V1_JSON_SCHEMA.$defs.asset.properties.path.pattern,
    );
    for (const value of ["aa", "assets/card.png", "notes..svg", "ab/image.svg"])
      expect(path.test(value)).toBe(true);
    for (const value of ["../secret", "a/../secret", "/absolute", "a\\b"])
      expect(path.test(value)).toBe(false);
  });
  it("keeps the published JSON Schema synchronized with every operation", () => {
    const published: unknown = JSON.parse(
      readFileSync("schemas/sniptale-effect-v1.schema.json", "utf8"),
    );
    const commandOps = EFFECT_V1_JSON_SCHEMA.$defs.command.oneOf.map((schema) =>
      responseString(schema, "properties", "op", "const"),
    );
    const expressionOps = EFFECT_V1_JSON_SCHEMA.$defs.expression.anyOf
      .map((schema) =>
        "properties" in schema ? schema.properties.op.const : undefined,
      )
      .filter(Boolean);

    expect(published).toEqual(EFFECT_V1_JSON_SCHEMA);
    expect(commandOps).toEqual(
      expect.arrayContaining([...EFFECT_V1_COMMAND_OPS]),
    );
    expect(new Set(commandOps).size).toBe(EFFECT_V1_COMMAND_OPS.length);
    expect(expressionOps).toEqual(
      expect.arrayContaining([...EFFECT_V1_EXPRESSION_OPS]),
    );
    expect(new Set(expressionOps).size).toBe(EFFECT_V1_EXPRESSION_OPS.length);
  });

  it("accepts strict standalone JSON and derives its internal template", () => {
    const document = createDocument();
    const result = validateEffectV1Document(document);

    expect(result).toMatchObject({
      ok: true,
      summary: { errors: 0, warnings: 0 },
    });
    if (!result.document) throw new Error("Valid effect fixture was rejected.");
    expect(normalizeEffectV1ToTemplate(result.document)).toMatchObject({
      effectId: "agent-card",
      id: "agent-card",
      kind: "composition",
      moduleId: "agent-card",
      target: "scene",
    });
    expect(EFFECT_V1_JSON_SCHEMA.properties.schemaVersion).toEqual({
      const: EFFECT_V1_SCHEMA,
    });
  });

  it("derives runtime inputs solely from the public kind", () => {
    expect(resolveEffectV1InputContract("standalone")).toEqual({
      optional: [],
      required: [],
    });
    expect(resolveEffectV1InputContract("targetEffect")).toEqual({
      optional: [],
      required: ["source"],
    });
    expect(resolveEffectV1InputContract("transition")).toEqual({
      optional: [],
      required: ["from", "to"],
    });
  });

  it("allows image commands to consume only inputs owned by the effect kind", () => {
    const transition = createDocument();
    transition.kind = "transition";
    transition.program.commands = [
      {
        height: 720,
        input: "from",
        op: "image",
        width: 1280,
        x: 0,
        y: 0,
      },
      {
        height: 720,
        input: "to",
        op: "image",
        width: 1280,
        x: 0,
        y: 0,
      },
    ];
    expect(validateEffectV1Document(transition).ok).toBe(true);

    const command = requiredEntry(transition.program.commands, 0);
    if (command.op !== "image")
      throw new Error("Expected image command fixture.");
    command.input = "source";
    expect(validateEffectV1Document(transition).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "IMAGE_INPUT_UNAVAILABLE" }),
      ]),
    );

    const standalone = createDocument();
    standalone.program.commands = [
      {
        height: 720,
        input: "source",
        op: "image",
        width: 1280,
        x: 0,
        y: 0,
      },
    ];
    expect(validateEffectV1Document(standalone).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "IMAGE_INPUT_UNAVAILABLE" }),
      ]),
    );
  });

  it("rejects executable and silently ignored legacy fields", () => {
    const result = validateEffectV1Document({
      ...createDocument(),
      engineVersion: "2.0-prototype",
      renderer: { kind: "compiled-js", source: "alert(1)" },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "EXECUTABLE_FIELD_FORBIDDEN",
          path: "$.engineVersion",
        }),
        expect.objectContaining({
          code: "EXECUTABLE_FIELD_FORBIDDEN",
          path: "$.renderer",
        }),
        expect.objectContaining({ code: "UNKNOWN_FIELD" }),
      ]),
    );
  });

  it("returns actionable strict-JSON diagnostics", () => {
    const result = parseEffectV1Source(
      "{ schemaVersion: 'sniptale.effect.v1' }",
    );

    expect(result).toMatchObject({ ok: false });
    expect(requiredEntry(result.diagnostics, 0)).toMatchObject({
      code: "JSON_INVALID",
      path: "$",
      severity: "error",
    });
    expect(requiredEntry(result.diagnostics, 0).suggestion).toContain(
      "double-quoted",
    );
  });

  it("requires document-local asset closure", () => {
    const document = createDocument();
    document.layers = [
      {
        assetId: "pack-global-audio",
        id: "sound",
        name: "Sound",
        type: "audio",
      },
    ];
    document.clips = [
      { duration: 2, layerId: "sound", sceneId: "main", start: 0 },
    ];

    const result = validateEffectV1Document(document);

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "LAYER_ASSET_UNKNOWN",
          path: "$.layers[0].assetId",
        }),
      ]),
    );
    expect(
      requireDiagnostic(result.diagnostics, "LAYER_ASSET_UNKNOWN").suggestion,
    ).toContain("pack-global");
  });

  it("never silently sorts keyframes", () => {
    const document = createDocument();
    document.layers = [{ id: "card", name: "Card", type: "customDraw" }];
    document.clips = [
      { duration: 2, layerId: "card", sceneId: "main", start: 0 },
    ];
    document.timeline.tracks = [
      {
        id: "card.opacity",
        keyframes: [
          { id: "late", time: 1.5, value: 1 },
          { id: "early", time: 0.5, value: 0 },
        ],
        target: "card",
      },
    ];

    const result = validateEffectV1Document(document);

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "KEYFRAME_ORDER",
          path: "$.timeline.tracks[0].keyframes[1].time",
        }),
      ]),
    );
  });

  it("rejects editable tracks that the runtime graph never reads", () => {
    const document = createDocument();
    document.layers = [{ id: "card", name: "Card", type: "customDraw" }];
    document.clips = [
      { duration: 2, layerId: "card", sceneId: "main", start: 0 },
    ];
    document.timeline.tracks = [
      {
        id: "card.opacity",
        keyframes: [
          { id: "start", time: 0, value: 0 },
          { id: "end", time: 2, value: 1 },
        ],
        target: "card",
      },
    ];

    const result = validateEffectV1Document(document);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "TRACK_UNUSED",
          path: "$.timeline.tracks[0]",
        }),
      ]),
    );
    expect(
      requireDiagnostic(result.diagnostics, "TRACK_UNUSED").suggestion,
    ).toContain("tracks.card.opacity");
  });

  it("accepts standard tracks consumed through a layer-bound command", () => {
    const document = createDocument();
    document.layers = [{ id: "card", name: "Card", type: "customDraw" }];
    document.clips = [
      { duration: 2, layerId: "card", sceneId: "main", start: 0 },
    ];
    document.timeline.tracks = [
      {
        id: "card.opacity",
        keyframes: [
          { id: "opacity-start", time: 0, value: 0 },
          { id: "opacity-end", time: 2, value: 1 },
        ],
        property: "opacity",
        target: "card",
      },
      {
        id: "card.rotation",
        keyframes: [
          { id: "rotation-start", time: 0, value: 0 },
          { id: "rotation-end", time: 2, value: 0.25 },
        ],
        property: "rotation",
        target: "card",
      },
    ];
    document.program.commands.push({
      fill: "#fff",
      height: 100,
      layerId: "card",
      op: "shape",
      rotation: { op: "read", path: "layers.card.rotation" },
      shape: "rect",
      width: 200,
      x: 100,
      y: 100,
    });

    expect(validateEffectV1Document(document)).toMatchObject({
      ok: true,
      summary: { errors: 0, warnings: 0 },
    });
  });

  it("blocks unbounded render work and expression cycles", () => {
    const document = createDocument();
    responseObject(document).program = {
      commands: [
        {
          commands: [{ color: "#000", op: "clear" }],
          count: { op: "read", path: "width" },
          indexVar: "i",
          op: "forRange",
        },
      ],
      definitions: {
        a: { op: "read", path: "defs.b" },
        b: { op: "read", path: "defs.a" },
      },
      kind: "graph",
      version: 1,
    };

    const result = validateEffectV1Document(document);

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "LOOP_BOUND" }),
        expect.objectContaining({ code: "DEFINITION_CYCLE" }),
      ]),
    );
  });

  it("rejects graph references that are not declared by the document", () => {
    const document = createDocument();
    document.program.commands = [
      {
        fill: { op: "read", path: "controls.missing" },
        height: { op: "read", path: "input.source" },
        layerId: "missing-layer",
        op: "shape",
        shape: "rect",
        width: { op: "read", path: "tracks.missing" },
        x: { op: "read", path: "defs.missing" },
        y: 0,
      },
    ];

    const result = validateEffectV1Document(document);

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "COMMAND_LAYER_UNKNOWN" }),
        expect.objectContaining({
          code: "READ_REFERENCE_UNKNOWN",
        }),
        expect.objectContaining({
          code: "READ_REFERENCE_UNKNOWN",
        }),
        expect.objectContaining({
          code: "READ_REFERENCE_UNKNOWN",
        }),
        expect.objectContaining({
          code: "READ_REFERENCE_UNKNOWN",
        }),
      ]),
    );
    expect(
      result.diagnostics
        .filter((issue) => issue.code === "READ_REFERENCE_UNKNOWN")
        .map((issue) => issue.message),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('control "missing"'),
        expect.stringContaining('track "missing"'),
        expect.stringContaining('definition "missing"'),
        expect.stringContaining('runtime input "source"'),
      ]),
    );
  });

  it("reports nested authoring typos and invalid control ranges at exact paths", () => {
    const document = createDocument();
    document.layers = [{ id: "card", name: "Card", type: "rect" }];
    responseObject(document, "layers", 0).widht = 320;
    document.clips = [
      { duration: 2, layerId: "card", sceneId: "main", start: 0 },
    ];
    document.controls = [
      {
        defaultValue: 5,
        id: "density",
        kind: "number",
        max: 1,
        min: 10,
      },
    ];

    const result = validateEffectV1Document(document);

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "UNKNOWN_FIELD",
          path: "$.layers[0].widht",
        }),
        expect.objectContaining({
          code: "CONTROL_RANGE",
          path: "$.controls[0]",
        }),
      ]),
    );
  });

  it("requires number controls to have a usable range and default", () => {
    const document = createDocument();
    document.controls = [
      {
        defaultValue: 2,
        id: "fixed",
        kind: "number",
        max: 1,
        min: 1,
        step: 0,
      },
    ];
    document.program.commands.push({
      alpha: { op: "read", path: "controls.fixed" },
      fill: "#fff",
      height: 1,
      op: "fillRect",
      width: 1,
      x: 0,
      y: 0,
    });

    expect(validateEffectV1Document(document).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "CONTROL_RANGE" }),
        expect.objectContaining({
          code: "CONTROL_STEP",
          path: "$.controls[0].step",
        }),
        expect.objectContaining({
          code: "CONTROL_DEFAULT_RANGE",
          path: "$.controls[0].defaultValue",
        }),
      ]),
    );
  });

  it("rejects motion paths with unknown layers, keyframes, and point fields", () => {
    const document = createDocument();
    responseObject(document, "timeline").motionPaths = [
      {
        layerId: "missing-layer",
        points: [
          {
            xKeyframeId: "missing-x",
            yKeyframeId: "missing-y",
            z: 3,
          },
        ],
      },
    ];

    const result = validateEffectV1Document(document);

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MOTION_PATH_LAYER_UNKNOWN" }),
        expect.objectContaining({
          code: "UNKNOWN_FIELD",
          path: "$.timeline.motionPaths[0].points[0].z",
        }),
        expect.objectContaining({ code: "MOTION_POINT_KEYFRAME_UNKNOWN" }),
      ]),
    );
  });

  it("validates the typed curved-path segment DSL without open command bags", () => {
    const document = createDocument();
    document.program.commands = [
      {
        fill: "#fff",
        op: "path",
        segments: [
          { kind: "moveTo", x: 0, y: 0 },
          { cpx: 10, cpy: 0, kind: "quadraticTo", x: 10, y: 10 },
          {
            cp1x: 20,
            cp1y: 10,
            cp2x: 20,
            cp2y: 20,
            kind: "cubicTo",
            x: 30,
            y: 20,
          },
          {
            centerX: 30,
            centerY: 30,
            end: Math.PI,
            kind: "arc",
            radius: 10,
            start: 0,
          },
        ],
      },
    ];
    expect(validateEffectV1Document(document).ok).toBe(true);

    const pathProbe = responseObject(document, "program", "commands", 0);
    pathProbe.points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    responseObject(pathProbe, "segments", 1).typo = 1;
    expect(validateEffectV1Document(document).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "COMMAND_PATH_SOURCE" }),
        expect.objectContaining({
          code: "UNKNOWN_FIELD",
          path: "$.program.commands[0].segments[1].typo",
        }),
      ]),
    );
  });

  it("has no localFixture compatibility parser", () => {
    const document = createDocument();
    const legacy = {
      ...document,
      program: {
        fixtureId: "legacy-local-fixture",
        kind: "localFixture",
      },
    };

    expect(validateEffectV1Document(legacy).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "PROGRAM_KIND" }),
        expect.objectContaining({ code: "UNKNOWN_FIELD" }),
      ]),
    );
  });
});

function createDocument(): EffectV1Document {
  return {
    assets: [],
    clips: [],
    controls: [],
    description: {
      en: "A minimal agent-authored effect.",
      ru: "Минимальный эффект, созданный агентом.",
    },
    duration: 2,
    id: "agent-card",
    kind: "standalone",
    label: { en: "Agent card", ru: "Карточка агента" },
    layers: [],
    program: {
      commands: [{ color: "#101820", op: "clear" }],
      kind: "graph",
      version: 1,
    },
    scenes: [{ duration: 2, id: "main", start: 0 }],
    schemaVersion: EFFECT_V1_SCHEMA,
    timeline: { phases: [], tracks: [] },
  };
}

function requireDiagnostic(diagnostics: EffectV1Diagnostic[], code: string) {
  const diagnostic = diagnostics.find((entry) => entry.code === code);
  if (!diagnostic) throw new Error(`Missing expected diagnostic ${code}.`);
  return diagnostic;
}
