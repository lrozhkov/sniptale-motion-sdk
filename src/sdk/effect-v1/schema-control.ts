import {
  controlPresentationProperties,
  controlPresentationRules,
} from "./schema-control-presentation.js";
const identifier = {
  type: "string",
  pattern: "^[a-zA-Z][a-zA-Z0-9._-]{0,127}$",
};
export const controlSchema = {
  allOf: [
    ...controlPresentationRules,
    {
      if: {
        properties: { kind: { enum: ["number", "color"] } },
        required: ["kind"],
      },
      then: { not: { required: ["localizedDefaultValue"] } },
    },
    {
      if: { properties: { kind: { const: "color" } }, required: ["kind"] },
      then: { not: { required: ["options"] } },
    },
    {
      if: { properties: { kind: { const: "number" } }, required: ["kind"] },
      then: {
        properties: {
          defaultValue: { type: "number" },
          options: { items: { properties: { value: { type: "number" } } } },
        },
      },
    },
    {
      if: {
        properties: { kind: { enum: ["text", "color"] } },
        required: ["kind"],
      },
      then: {
        properties: {
          defaultValue: { type: "string" },
          options: { items: { properties: { value: { type: "string" } } } },
        },
      },
    },
  ],
  additionalProperties: false,
  properties: {
    ...controlPresentationProperties,
    order: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
    options: {
      type: "array",
      minItems: 2,
      maxItems: 64,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["value", "label"],
        properties: {
          value: { type: ["string", "number"] },
          icon: controlPresentationProperties.icon,
          label: { $ref: "#/$defs/localeText" },
        },
      },
    },
    defaultValue: {},
    localizedDefaultValue: { $ref: "#/$defs/localeText" },
    id: identifier,
    kind: { enum: ["color", "number", "text"] },
    label: { $ref: "#/$defs/localeText" },
    max: { type: "number" },
    min: { type: "number" },
    step: { exclusiveMinimum: 0, type: "number" },
  },
  required: ["defaultValue", "id", "kind"],
  type: "object",
} as const;
