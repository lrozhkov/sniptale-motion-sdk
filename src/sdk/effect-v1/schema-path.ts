const expression = { $ref: "#/$defs/expression" };
const numericExpression = {
  anyOf: [{ type: "number" }, { allOf: [expression, { type: "object" }] }],
};
const point = { $ref: "#/$defs/point" };
const pathSegment = { $ref: "#/$defs/pathSegment" };

export function createEffectV1PathCommandSchema(
  command: (
    op: string,
    properties: Record<string, unknown>,
    required?: string[],
  ) => Record<string, unknown>,
  style: Record<string, unknown>,
  paint: Record<string, unknown>,
) {
  return {
    ...command("path", {
      ...style,
      closed: { type: "boolean" },
      fill: paint,
      lineCap: { enum: ["butt", "round", "square"] },
      lineJoin: { enum: ["bevel", "miter", "round"] },
      lineWidth: numericExpression,
      points: { items: point, minItems: 2, type: "array" },
      segments: { items: pathSegment, minItems: 1, type: "array" },
      stroke: paint,
    }),
    oneOf: [
      { not: { required: ["segments"] }, required: ["points"] },
      { not: { required: ["points"] }, required: ["segments"] },
    ],
  };
}

export const EFFECT_V1_PATH_SEGMENT_SCHEMA = {
  oneOf: [
    segment("moveTo", { x: numericExpression, y: numericExpression }, [
      "x",
      "y",
    ]),
    segment("lineTo", { x: numericExpression, y: numericExpression }, [
      "x",
      "y",
    ]),
    segment(
      "quadraticTo",
      {
        cpx: numericExpression,
        cpy: numericExpression,
        x: numericExpression,
        y: numericExpression,
      },
      ["cpx", "cpy", "x", "y"],
    ),
    segment(
      "cubicTo",
      {
        cp1x: numericExpression,
        cp1y: numericExpression,
        cp2x: numericExpression,
        cp2y: numericExpression,
        x: numericExpression,
        y: numericExpression,
      },
      ["cp1x", "cp1y", "cp2x", "cp2y", "x", "y"],
    ),
    segment(
      "arc",
      {
        centerX: numericExpression,
        centerY: numericExpression,
        counterclockwise: { type: "boolean" },
        end: numericExpression,
        radius: numericExpression,
        start: numericExpression,
      },
      ["centerX", "centerY", "end", "radius", "start"],
    ),
    segment(
      "ellipse",
      {
        centerX: numericExpression,
        centerY: numericExpression,
        counterclockwise: { type: "boolean" },
        end: numericExpression,
        radiusX: numericExpression,
        radiusY: numericExpression,
        rotation: numericExpression,
        start: numericExpression,
      },
      ["centerX", "centerY", "end", "radiusX", "radiusY", "rotation", "start"],
    ),
    segment(
      "rect",
      {
        height: numericExpression,
        width: numericExpression,
        x: numericExpression,
        y: numericExpression,
      },
      ["height", "width", "x", "y"],
    ),
    segment(
      "roundRect",
      {
        height: numericExpression,
        radius: numericExpression,
        width: numericExpression,
        x: numericExpression,
        y: numericExpression,
      },
      ["height", "radius", "width", "x", "y"],
    ),
  ],
};

function segment(
  kind: string,
  properties: Record<string, unknown>,
  required: string[],
) {
  return {
    additionalProperties: false,
    properties: { kind: { const: kind }, ...properties },
    required: ["kind", ...required],
    type: "object",
  };
}
