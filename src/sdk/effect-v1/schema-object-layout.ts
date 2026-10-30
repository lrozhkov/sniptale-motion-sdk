import { EFFECT_V1_OBJECT_MAX_SIZE } from "./object-layout.js";

export const objectLayoutSchema = {
  additionalProperties: false,
  properties: {
    width: { minimum: 1, maximum: EFFECT_V1_OBJECT_MAX_SIZE, type: "number" },
    height: { minimum: 1, maximum: EFFECT_V1_OBJECT_MAX_SIZE, type: "number" },
    resize: { enum: ["scale", "reflow"] },
    handles: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$" },
          label: { $ref: "#/$defs/localeText" },
          xControl: {
            type: "string",
            pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$",
          },
          yControl: {
            type: "string",
            pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$",
          },
          padding: { type: "number", minimum: 0, maximum: 256 },
        },
        required: ["id", "label", "xControl", "yControl", "padding"],
      },
    },
  },
  required: ["width", "height", "resize"],
  type: "object",
  allOf: [
    {
      if: { required: ["handles"] },
      then: { properties: { resize: { const: "scale" } } },
    },
  ],
} as const;

export const objectLayoutKindSchema = {
  if: { required: ["objectLayout"] },
  then: { properties: { kind: { const: "standalone" } } },
} as const;
