const id = { type: "string", pattern: "^[a-zA-Z][a-zA-Z0-9._-]{0,127}$" };
const named = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label"],
  properties: { id, label: { $ref: "#/$defs/localeText" } },
};
export const controlPresetsSchema = {
  type: "array",
  minItems: 1,
  maxItems: 64,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["id", "label", "theme", "style", "values"],
    properties: {
      id,
      label: { $ref: "#/$defs/localeText" },
      theme: named,
      style: named,
      values: {
        type: "object",
        minProperties: 1,
        maxProperties: 256,
        propertyNames: id,
        additionalProperties: { type: ["string", "number"] },
      },
    },
  },
} as const;
export const controlPresetsDependencySchema = {
  dependentRequired: {
    controlPresets: ["defaultControlPresetId"],
    defaultControlPresetId: ["controlPresets"],
  },
} as const;
