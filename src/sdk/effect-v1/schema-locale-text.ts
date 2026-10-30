export const localeTextSchema = {
  additionalProperties: false,
  required: ["en"],
  properties: { en: { type: "string", minLength: 1, pattern: "\\S" } },
  patternProperties: {
    "^(?:[a-zA-Z]{2,8}|[iIxX])(?:-[a-zA-Z0-9]{1,8})*$": { type: "string" },
  },
  type: "object",
} as const;
