import {
  EFFECT_V1_CONTROL_GROUPS,
  EFFECT_V1_CONTROL_UNITS,
  EFFECT_V1_CONTROL_ICONS,
  EFFECT_V1_CONTROL_PRESENTATIONS,
  EFFECT_V1_CONTROL_GROUP_LIMIT,
} from "./control-presentation-model.js";

const id = { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$" };
export const controlPresentationProperties = {
  group: id,
  unit: { enum: EFFECT_V1_CONTROL_UNITS },
  presentation: { enum: EFFECT_V1_CONTROL_PRESENTATIONS },
  icon: { enum: EFFECT_V1_CONTROL_ICONS },
};
function presentationRule(
  kinds: readonly string[],
  then: Record<string, unknown>,
) {
  return {
    if: {
      properties: { presentation: { enum: kinds } },
      required: ["presentation"],
    },
    then,
  };
}
export const controlPresentationRules = [
  {
    if: { required: ["unit"] },
    then: { properties: { kind: { const: "number" } } },
  },
  presentationRule(["dropdown", "segmented", "toggle"], {
    required: ["options"],
    properties: { kind: { enum: ["number", "text"] } },
  }),
  presentationRule(["segmented"], { properties: { options: { maxItems: 8 } } }),
  presentationRule(["toggle"], {
    properties: { options: { minItems: 2, maxItems: 2 } },
  }),
  presentationRule(["number", "slider"], {
    properties: { kind: { const: "number" } },
    not: { required: ["options"] },
  }),
  presentationRule(["text", "textarea"], {
    properties: { kind: { const: "text" } },
    not: { required: ["options"] },
  }),
  presentationRule(["color"], {
    properties: { kind: { const: "color" } },
    not: { required: ["options"] },
  }),
];
export const controlGroupsSchema = {
  type: "array",
  maxItems: EFFECT_V1_CONTROL_GROUP_LIMIT,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["id", "label", "parentId"],
    properties: {
      id: { ...id, not: { enum: EFFECT_V1_CONTROL_GROUPS } },
      parentId: id,
      label: { $ref: "#/$defs/localeText" },
      order: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
      icon: { enum: EFFECT_V1_CONTROL_ICONS },
      collapsed: { type: "boolean" },
    },
  },
};
