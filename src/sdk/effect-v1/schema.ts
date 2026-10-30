import { localeTextSchema as localeText } from "./schema-locale-text.js";
import {
  editorRegionSchema,
  editorRegionKindSchema,
} from "./schema-editor-region.js";
import {
  controlPresetsSchema,
  controlPresetsDependencySchema,
} from "./schema-control-presets.js";
import { controlSchema } from "./schema-control.js";
import {
  objectLayoutSchema,
  objectLayoutKindSchema,
} from "./schema-object-layout.js";
import {
  EFFECT_V1_EXPRESSION_OPS,
  EFFECT_V1_KINDS,
  EFFECT_V1_SCHEMA,
} from "./types.js";
import {
  createEffectV1PathCommandSchema,
  EFFECT_V1_PATH_SEGMENT_SCHEMA,
} from "./schema-path.js";

const identifier = {
  pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$",
  type: "string",
};
const expression = { $ref: "#/$defs/expression" };
const expressionObject = {
  allOf: [expression, { type: "object" }],
};
const numericExpression = {
  anyOf: [{ type: "number" }, expressionObject],
};
const paint = { $ref: "#/$defs/paint" };

function expressionWithArgs(op: string, minimum: number, maximum = minimum) {
  return {
    additionalProperties: false,
    properties: {
      args: {
        items: expression,
        maxItems: maximum,
        minItems: minimum,
        type: "array",
      },
      op: { const: op },
    },
    required: ["args", "op"],
    type: "object",
  };
}

const commandBase = { layerId: identifier, op: { type: "string" } };
const style = {
  alpha: numericExpression,
  blend: {
    enum: ["lighter", "screen", "source-over", "source-atop", "destination-in"],
  },
  filter: { $ref: "#/$defs/filter" },
  shadow: { $ref: "#/$defs/shadow" },
};
function command(
  op: string,
  properties: Record<string, unknown>,
  required: string[] = [],
) {
  return {
    additionalProperties: false,
    properties: { ...commandBase, ...properties, op: { const: op } },
    required: ["op", ...required],
    type: "object",
  };
}

const childCommands = {
  items: { $ref: "#/$defs/command" },
  minItems: 1,
  type: "array",
};
const point = { $ref: "#/$defs/point" };
const imageCommand = {
  ...command(
    "image",
    {
      ...style,
      assetId: identifier,
      fit: { enum: ["contain", "cover", "fill"] },
      height: numericExpression,
      input: { enum: ["source", "from", "to"] },
      rotation: numericExpression,
      width: numericExpression,
      x: numericExpression,
      y: numericExpression,
    },
    ["height", "width", "x", "y"],
  ),
  oneOf: [
    { not: { required: ["input"] }, required: ["assetId"] },
    { not: { required: ["assetId"] }, required: ["input"] },
  ],
};
const pathCommand = createEffectV1PathCommandSchema(command, style, paint);

export const EFFECT_V1_JSON_SCHEMA = Object.freeze({
  $defs: {
    asset: {
      additionalProperties: false,
      allOf: [
        {
          anyOf: [
            { required: ["dataUrl"] },
            { required: ["path"] },
            { required: ["svgText"] },
          ],
        },
        {
          if: {
            anyOf: [{ required: ["dataUrl"] }, { required: ["svgText"] }],
          },
          then: { required: ["byteLength", "sha256"] },
        },
        {
          if: { properties: { kind: { const: "svg" } }, required: ["kind"] },
          then: {
            not: { required: ["dataUrl"] },
            properties: { mimeType: { const: "image/svg+xml" } },
          },
          else: { not: { required: ["svgText"] } },
        },
        {
          if: { properties: { kind: { const: "image" } }, required: ["kind"] },
          then: {
            properties: {
              mimeType: { enum: ["image/jpeg", "image/png", "image/webp"] },
            },
          },
        },
        {
          if: { properties: { kind: { const: "audio" } }, required: ["kind"] },
          then: {
            properties: {
              mimeType: { enum: ["audio/mpeg", "audio/ogg", "audio/wav"] },
            },
          },
        },
      ],
      properties: {
        byteLength: { minimum: 1, type: "integer" },
        dataUrl: {
          pattern: "^data:[^;,]+;base64,[A-Za-z0-9+/=]+$",
          type: "string",
        },
        duration: { exclusiveMinimum: 0, type: "number" },
        height: { exclusiveMinimum: 0, type: "number" },
        id: identifier,
        kind: { enum: ["audio", "image", "svg"] },
        mimeType: { type: "string" },
        path: {
          pattern: "^(?!/)(?!.*(?:^|/)\.\.(?:/|$))[^\\\\]+$",
          type: "string",
        },
        sha256: { pattern: "^[a-f0-9]{64}$", type: "string" },
        svgText: { type: "string" },
        width: { exclusiveMinimum: 0, type: "number" },
      },
      required: ["id", "kind", "mimeType"],
      type: "object",
    },
    clip: {
      additionalProperties: false,
      properties: {
        duration: { exclusiveMinimum: 0, type: "number" },
        enabled: { type: "boolean" },
        layerId: identifier,
        locked: { type: "boolean" },
        offset: { type: "number" },
        sceneId: identifier,
        start: { minimum: 0, type: "number" },
      },
      required: ["duration", "layerId", "start"],
      type: "object",
    },
    command: {
      oneOf: [
        command("clear", { color: paint }),
        command(
          "clip",
          {
            commands: childCommands,
            height: numericExpression,
            width: numericExpression,
            x: numericExpression,
            y: numericExpression,
          },
          ["commands", "height", "width", "x", "y"],
        ),
        command(
          "compositePass",
          {
            ...style,
            height: numericExpression,
            passId: identifier,
            rotation: numericExpression,
            width: numericExpression,
            x: numericExpression,
            y: numericExpression,
          },
          ["passId"],
        ),
        command(
          "fillRect",
          {
            ...style,
            fill: paint,
            height: numericExpression,
            width: numericExpression,
            x: numericExpression,
            y: numericExpression,
          },
          ["fill", "height", "width", "x", "y"],
        ),
        command(
          "forEach",
          {
            commands: childCommands,
            itemVar: identifier,
            items: { minItems: 1, type: "array" },
          },
          ["commands", "items"],
        ),
        command(
          "forGrid",
          {
            columnVar: identifier,
            columns: { maximum: 512, minimum: 1, type: "integer" },
            commands: childCommands,
            rowVar: identifier,
            rows: { maximum: 512, minimum: 1, type: "integer" },
          },
          ["columns", "commands", "rows"],
        ),
        command(
          "forRange",
          {
            commands: childCommands,
            count: { maximum: 512, minimum: 1, type: "integer" },
            indexVar: identifier,
          },
          ["commands", "count"],
        ),
        command(
          "group",
          {
            ...style,
            commands: childCommands,
            rotation: numericExpression,
            scaleX: numericExpression,
            scaleY: numericExpression,
            x: numericExpression,
            y: numericExpression,
          },
          ["commands"],
        ),
        imageCommand,
        command(
          "let",
          {
            bindings: {
              additionalProperties: expression,
              minProperties: 1,
              type: "object",
            },
            commands: childCommands,
          },
          ["bindings", "commands"],
        ),
        pathCommand,
        command(
          "polyline",
          {
            ...style,
            lineCap: { enum: ["butt", "round", "square"] },
            lineJoin: { enum: ["bevel", "miter", "round"] },
            lineWidth: numericExpression,
            points: { items: point, minItems: 2, type: "array" },
            progress: numericExpression,
            stroke: paint,
          },
          ["points", "stroke"],
        ),
        command(
          "renderPass",
          {
            commands: childCommands,
            height: numericExpression,
            id: identifier,
            width: numericExpression,
          },
          ["commands", "id"],
        ),
        command(
          "sampledPath",
          {
            ...style,
            from: numericExpression,
            lineCap: { enum: ["butt", "round", "square"] },
            lineJoin: { enum: ["bevel", "miter", "round"] },
            lineWidth: numericExpression,
            samples: { maximum: 256, minimum: 2, type: "integer" },
            sampleVar: identifier,
            stroke: paint,
            to: numericExpression,
            x: numericExpression,
            y: numericExpression,
          },
          ["from", "samples", "stroke", "to", "x", "y"],
        ),
        command(
          "shape",
          {
            ...style,
            fill: paint,
            height: numericExpression,
            lineWidth: numericExpression,
            radius: numericExpression,
            rotation: numericExpression,
            shape: {
              enum: ["circle", "diamond", "ellipse", "rect", "roundRect"],
            },
            stroke: paint,
            width: numericExpression,
            x: numericExpression,
            y: numericExpression,
          },
          ["height", "shape", "width", "x", "y"],
        ),
        command(
          "stableOrderBy",
          {
            commands: childCommands,
            direction: { enum: ["asc", "desc"] },
            itemVar: identifier,
            items: { minItems: 1, type: "array" },
            key: expression,
          },
          ["commands", "items", "key"],
        ),
        command(
          "svgParts",
          {
            ...style,
            assetId: identifier,
            height: numericExpression,
            part: { $ref: "#/$defs/svgPartTransform" },
            width: numericExpression,
            x: numericExpression,
            y: numericExpression,
          },
          ["assetId", "height", "width", "x", "y"],
        ),
        command(
          "text",
          {
            ...style,
            align: { enum: ["center", "end", "left", "right", "start"] },
            baseline: {
              enum: [
                "alphabetic",
                "bottom",
                "hanging",
                "ideographic",
                "middle",
                "top",
              ],
            },
            caret: { type: "boolean" },
            fill: paint,
            fontFamily: expression,
            fontSize: numericExpression,
            fontStyle: { enum: ["italic", "normal", "oblique"] },
            fontWeight: expression,
            maxWidth: numericExpression,
            reveal: numericExpression,
            text: expression,
            x: numericExpression,
            y: numericExpression,
          },
          ["text", "x", "y"],
        ),
        command("when", { commands: childCommands, condition: expression }, [
          "commands",
          "condition",
        ]),
      ],
    },
    control: controlSchema,
    expression: {
      anyOf: [
        { type: ["boolean", "number", "string", "null"] },
        expressionWithArgs("abs", 1),
        expressionWithArgs("add", 1, 64),
        expressionWithArgs("and", 1, 64),
        expressionWithArgs("clamp", 3),
        expressionWithArgs("concat", 1, 64),
        expressionWithArgs("cos", 1),
        expressionWithArgs("cubicPoint", 5),
        expressionWithArgs("cubicTangent", 5),
        expressionWithArgs("div", 2),
        expressionWithArgs("ellipsePoint", 5),
        expressionWithArgs("ellipseVelocity", 5),
        expressionWithArgs("eq", 2),
        expressionWithArgs("exp", 1),
        expressionWithArgs("floor", 1),
        expressionWithArgs("gt", 2),
        expressionWithArgs("gte", 2),
        expressionWithArgs("inOut", 1),
        expressionWithArgs("lt", 2),
        expressionWithArgs("lte", 2),
        expressionWithArgs("max", 1, 64),
        expressionWithArgs("min", 1, 64),
        expressionWithArgs("mix", 3),
        expressionWithArgs("mod", 2),
        expressionWithArgs("mul", 1, 64),
        expressionWithArgs("neg", 1),
        expressionWithArgs("not", 1),
        expressionWithArgs("or", 1, 64),
        expressionWithArgs("out", 1),
        expressionWithArgs("point", 2),
        expressionWithArgs("pow", 2),
        expressionWithArgs("rgba", 3, 4),
        expressionWithArgs("sin", 1),
        expressionWithArgs("sqrt", 1),
        expressionWithArgs("sub", 2),
        {
          additionalProperties: false,
          properties: { op: { const: "read" }, path: { type: "string" } },
          required: ["op", "path"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            fallback: expression,
            op: { const: "fallback" },
            value: expression,
          },
          required: ["fallback", "op", "value"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            op: { const: "select" },
            value: expression,
            values: {
              items: expression,
              maxItems: 2,
              minItems: 2,
              type: "array",
            },
          },
          required: ["op", "value", "values"],
          type: "object",
        },
      ],
    },
    filter: {
      additionalProperties: false,
      minProperties: 1,
      properties: {
        blur: numericExpression,
        brightness: numericExpression,
        saturate: numericExpression,
      },
      type: "object",
    },
    gradientStop: {
      additionalProperties: false,
      properties: {
        color: { anyOf: [{ type: "string" }, expressionObject] },
        offset: numericExpression,
      },
      required: ["color", "offset"],
      type: "object",
    },
    keyframe: {
      additionalProperties: false,
      properties: {
        easing: { type: "string" },
        enabled: { type: "boolean" },
        handles: { $ref: "#/$defs/keyframeHandles" },
        id: identifier,
        phaseId: identifier,
        sceneId: identifier,
        time: { minimum: 0, type: "number" },
        value: {},
      },
      required: ["id", "time", "value"],
      type: "object",
    },
    keyframeHandles: {
      additionalProperties: false,
      properties: {
        x1: { type: "number" },
        x2: { type: "number" },
        y1: { type: "number" },
        y2: { type: "number" },
      },
      required: ["x1", "x2", "y1", "y2"],
      type: "object",
    },
    layer: {
      additionalProperties: false,
      allOf: [
        {
          if: {
            properties: {
              type: {
                enum: [
                  "ellipse",
                  "imageAsset",
                  "line",
                  "path",
                  "rect",
                  "svgAsset",
                  "text",
                ],
              },
            },
            required: ["type"],
          },
          then: { required: ["height", "width"] },
        },
        {
          if: {
            properties: { type: { enum: ["audio", "imageAsset", "svgAsset"] } },
            required: ["type"],
          },
          then: { required: ["assetId"] },
        },
        {
          if: { properties: { type: { const: "text" } }, required: ["type"] },
          then: { required: ["text"] },
        },
        {
          if: { properties: { type: { const: "group" } }, required: ["type"] },
          then: {
            not: {
              anyOf: [
                "assetId",
                "editor",
                "height",
                "opacity",
                "rotation",
                "scaleX",
                "scaleY",
                "width",
                "x",
                "y",
              ].map((field) => ({ required: [field] })),
            },
          },
        },
      ],
      properties: {
        anchorX: { type: "number" },
        anchorY: { type: "number" },
        assetId: identifier,
        baseX: { type: "number" },
        baseY: { type: "number" },
        blendMode: { type: "string" },
        blur: { type: "number" },
        color: { type: "string" },
        editor: { $ref: "#/$defs/layerEditor" },
        fill: { type: "string" },
        fontFamily: { type: "string" },
        fontSize: { type: "number" },
        fontWeight: { type: "number" },
        height: { exclusiveMinimum: 0, type: "number" },
        id: identifier,
        locked: { type: "boolean" },
        name: { type: "string" },
        opacity: { type: "number" },
        parentId: { anyOf: [identifier, { type: "null" }] },
        partBlur: { type: "number" },
        partOrder: { type: "string" },
        partReveal: { type: "number" },
        partSpread: { type: "number" },
        partStagger: { type: "number" },
        pathClosed: { type: "boolean" },
        pathPoints: { type: "array" },
        radius: { type: "number" },
        rotation: { type: "number" },
        scaleX: { type: "number" },
        scaleY: { type: "number" },
        stroke: { type: "string" },
        strokeWidth: { type: "number" },
        svgPartIds: { items: { type: "string" }, type: "array" },
        svgPartMode: { type: "string" },
        text: { type: "string" },
        trimEnd: { type: "number" },
        trimStart: { type: "number" },
        type: {
          enum: [
            "audio",
            "customDraw",
            "ellipse",
            "group",
            "imageAsset",
            "line",
            "path",
            "rect",
            "svgAsset",
            "text",
          ],
        },
        visible: { type: "boolean" },
        volume: { type: "number" },
        width: { exclusiveMinimum: 0, type: "number" },
        x: { type: "number" },
        y: { type: "number" },
      },
      required: ["id", "type"],
      type: "object",
    },
    layerEditor: {
      additionalProperties: false,
      properties: {
        canvas: { enum: ["bounds", "fullFrame", "none"] },
        keyframeProperties: { items: { type: "string" }, type: "array" },
        operations: {
          items: { enum: ["delete", "duplicate", "reorder"] },
          type: "array",
        },
        properties: { items: { type: "string" }, type: "array" },
        transform: {
          items: {
            enum: [
              "anchorX",
              "anchorY",
              "rotation",
              "scaleX",
              "scaleY",
              "x",
              "y",
            ],
          },
          type: "array",
        },
      },
      type: "object",
    },
    localeText,
    motionPath: {
      additionalProperties: false,
      properties: {
        layerId: identifier,
        points: { items: { $ref: "#/$defs/motionPoint" }, type: "array" },
      },
      required: ["layerId", "points"],
      type: "object",
    },
    motionPoint: {
      additionalProperties: false,
      properties: {
        inTangent: { $ref: "#/$defs/pointNumber" },
        kind: { enum: ["corner", "linear", "smooth"] },
        outTangent: { $ref: "#/$defs/pointNumber" },
        xKeyframeId: identifier,
        yKeyframeId: identifier,
      },
      required: ["xKeyframeId", "yKeyframeId"],
      type: "object",
    },
    paint: {
      anyOf: [
        { type: "string" },
        expressionObject,
        {
          additionalProperties: false,
          properties: {
            kind: { const: "linearGradient" },
            stops: {
              items: { $ref: "#/$defs/gradientStop" },
              minItems: 2,
              type: "array",
            },
            x0: numericExpression,
            x1: numericExpression,
            y0: numericExpression,
            y1: numericExpression,
          },
          required: ["kind", "stops", "x0", "x1", "y0", "y1"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            kind: { const: "radialGradient" },
            r0: numericExpression,
            r1: numericExpression,
            stops: {
              items: { $ref: "#/$defs/gradientStop" },
              minItems: 2,
              type: "array",
            },
            x0: numericExpression,
            x1: numericExpression,
            y0: numericExpression,
            y1: numericExpression,
          },
          required: ["kind", "r0", "r1", "stops", "x0", "x1", "y0", "y1"],
          type: "object",
        },
      ],
    },
    phase: {
      additionalProperties: false,
      properties: {
        duration: { exclusiveMinimum: 0, type: "number" },
        enabled: { type: "boolean" },
        id: identifier,
        label: { type: "string" },
        locked: { type: "boolean" },
        sceneId: identifier,
        start: { minimum: 0, type: "number" },
      },
      required: ["duration", "id", "start"],
      type: "object",
    },
    point: {
      additionalProperties: false,
      properties: { x: numericExpression, y: numericExpression },
      required: ["x", "y"],
      type: "object",
    },
    pathSegment: EFFECT_V1_PATH_SEGMENT_SCHEMA,
    pointNumber: {
      additionalProperties: false,
      properties: { x: { type: "number" }, y: { type: "number" } },
      required: ["x", "y"],
      type: "object",
    },
    program: {
      additionalProperties: false,
      properties: {
        commands: {
          items: { $ref: "#/$defs/command" },
          minItems: 1,
          type: "array",
        },
        definitions: { additionalProperties: expression, type: "object" },
        kind: { const: "graph" },
        version: { const: 1 },
      },
      required: ["commands", "kind", "version"],
      type: "object",
    },
    scene: {
      additionalProperties: false,
      properties: {
        duration: { exclusiveMinimum: 0, type: "number" },
        enabled: { type: "boolean" },
        id: identifier,
        label: { anyOf: [{ type: "string" }, localeText] },
        locked: { type: "boolean" },
        start: { minimum: 0, type: "number" },
        transition: { type: "object" },
      },
      required: ["duration", "id", "start"],
      type: "object",
    },
    shadow: {
      additionalProperties: false,
      minProperties: 1,
      properties: {
        blur: numericExpression,
        color: { anyOf: [{ type: "string" }, expressionObject] },
        x: numericExpression,
        y: numericExpression,
      },
      type: "object",
    },
    svgPartTransform: {
      oneOf: [
        {
          additionalProperties: false,
          properties: {
            angle: numericExpression,
            blur: numericExpression,
            ease: { enum: ["inOut", "linear", "out"] },
            kind: { const: "preset" },
            mode: { enum: ["assemble", "scatter", "shatter"] },
            order: {
              enum: ["center", "document", "edges", "random", "reverse"],
            },
            reveal: numericExpression,
            rotate: numericExpression,
            scaleFrom: numericExpression,
            spread: numericExpression,
            stagger: numericExpression,
          },
          required: ["kind"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            alpha: numericExpression,
            blur: numericExpression,
            kind: { const: "custom" },
            originX: numericExpression,
            originY: numericExpression,
            rotate: numericExpression,
            scale: numericExpression,
            x: numericExpression,
            y: numericExpression,
          },
          required: ["kind"],
          type: "object",
        },
      ],
    },
    timeline: {
      additionalProperties: false,
      properties: {
        motionPaths: { items: { $ref: "#/$defs/motionPath" }, type: "array" },
        phases: { items: { $ref: "#/$defs/phase" }, type: "array" },
        tracks: { items: { $ref: "#/$defs/track" }, type: "array" },
      },
      required: ["phases", "tracks"],
      type: "object",
    },
    track: {
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" },
        id: identifier,
        keyframes: { items: { $ref: "#/$defs/keyframe" }, type: "array" },
        label: { type: "string" },
        layerId: identifier,
        phaseId: identifier,
        property: { type: "string" },
        sceneId: identifier,
        target: identifier,
      },
      required: ["id", "keyframes", "property"],
      type: "object",
    },
  },
  $id: "https://sniptale.local/schemas/effect-v1.schema.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  additionalProperties: false,
  properties: {
    assets: { items: { $ref: "#/$defs/asset" }, maxItems: 256, type: "array" },
    clips: { items: { $ref: "#/$defs/clip" }, type: "array" },
    controls: { items: { $ref: "#/$defs/control" }, type: "array" },
    controlPresets: controlPresetsSchema,
    defaultControlPresetId: identifier,
    description: localeText,
    duration: { exclusiveMinimum: 0, type: "number" },
    id: identifier,
    kind: { enum: EFFECT_V1_KINDS },
    label: localeText,
    layers: { items: { $ref: "#/$defs/layer" }, type: "array" },
    objectLayout: objectLayoutSchema,
    editorRegion: editorRegionSchema,
    presets: { type: "array" },
    program: { $ref: "#/$defs/program" },
    scenes: { items: { $ref: "#/$defs/scene" }, minItems: 1, type: "array" },
    schemaVersion: { const: EFFECT_V1_SCHEMA },
    timeline: { $ref: "#/$defs/timeline" },
  },
  required: [
    "assets",
    "clips",
    "controls",
    "duration",
    "id",
    "kind",
    "label",
    "layers",
    "program",
    "scenes",
    "schemaVersion",
    "timeline",
  ],
  title: "Sniptale Effect v1",
  allOf: [
    objectLayoutKindSchema,
    controlPresetsDependencySchema,
    editorRegionKindSchema,
  ],
  type: "object",
  xExpressionOperations: EFFECT_V1_EXPRESSION_OPS,
} as const);
