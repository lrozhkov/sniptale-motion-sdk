const id = { type: "string", pattern: "^[a-zA-Z][a-zA-Z0-9._-]{0,127}$" };
export const editorRegionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "label",
    "kind",
    "units",
    "position",
    "inset",
    "xControl",
    "yControl",
    "widthControl",
    "heightControl",
  ],
  properties: {
    id,
    label: { $ref: "#/$defs/localeText" },
    kind: { const: "rect" },
    units: { const: "percent" },
    position: { const: "available-space" },
    inset: { type: "number", minimum: 0, maximum: 0.25 },
    xControl: id,
    yControl: id,
    widthControl: id,
    heightControl: id,
  },
} as const;
export const editorRegionKindSchema = {
  if: { required: ["editorRegion"] },
  then: { properties: { kind: { const: "targetEffect" } } },
} as const;
