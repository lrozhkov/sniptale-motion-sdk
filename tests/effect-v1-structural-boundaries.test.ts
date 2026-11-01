import { describe, expect, it } from "vitest";
import { createStarterDocument } from "../src/apps/cli/starter.js";
import {
  EFFECT_V1_JSON_SCHEMA,
  validateEffectV1Document,
} from "../src/sdk/effect-v1/index.js";
import { responseObject } from "../tooling/test/fixtures/response.js";

function fixture() {
  const input: unknown = structuredClone(
    createStarterDocument("structural-boundary", "standalone"),
  );
  return {
    input,
    layer: responseObject(input, "layers", 0),
    scene: responseObject(input, "scenes", 0),
  };
}
const invalidStrings: readonly unknown[] = [
  null,
  4,
  false,
  [],
  {},
  { ru: "Фон", en: "Background" },
];
describe("schema-owned optional layer and scene fields", () => {
  it.each(invalidStrings.map((value) => ({ value })))(
    "rejects non-string layer fields: $value",
    ({ value }) => {
      const fields = Object.entries(
        EFFECT_V1_JSON_SCHEMA.$defs.layer.properties,
      )
        .filter(([, schema]) => "type" in schema && schema.type === "string")
        .map(([key]) => key);
      expect(fields).toContain("name");
      for (const field of fields)
        for (const presentationPolicy of ["authoring", "retained"] as const) {
          const { input, layer } = fixture();
          layer[field] = value;
          const result = validateEffectV1Document(input, {
            presentationPolicy,
          });
          expect(result.ok, `${field}/${presentationPolicy}`).toBe(false);
          expect(result.document).toBeUndefined();
          expect(
            result.diagnostics.some(
              (item) => item.path === `$.layers[0].${field}`,
            ),
          ).toBe(true);
        }
    },
  );
  it("accepts omitted names, plain strings and valid empty optional strings", () => {
    expect(validateEffectV1Document(fixture().input).ok).toBe(true);
    for (const [field, schema] of Object.entries(
      EFFECT_V1_JSON_SCHEMA.$defs.layer.properties,
    )) {
      if (
        !("type" in schema) ||
        schema.type !== "string" ||
        "pattern" in schema
      )
        continue;
      for (const value of ["", "Фон"]) {
        const { input, layer } = fixture();
        layer[field] = value;
        expect(validateEffectV1Document(input).ok, `${field}=${value}`).toBe(
          true,
        );
      }
    }
  });
  it.each([
    ["svgPartIds", [2]],
    ["svgPartIds", "glyph.rect-0"],
    ["svgPartIds", {}],
    ["pathPoints", {}],
    ["editor", { canvas: { toString: "bounds" } }],
    ["editor", { canvas: 1 }],
    ["editor", { operations: ["erase"] }],
    ["editor", { transform: ["width"] }],
  ] as const)("rejects malformed layer %s", (field, value) => {
    const { input, layer } = fixture();
    layer[field] = value;
    expect(validateEffectV1Document(input).ok).toBe(false);
  });
  it("accepts all published editor capability enum values", () => {
    const { input, layer } = fixture();
    const editor = EFFECT_V1_JSON_SCHEMA.$defs.layerEditor.properties;
    for (const canvas of editor.canvas.enum) {
      layer.editor = {
        canvas,
        operations: [...editor.operations.items.enum],
        transform: [...editor.transform.items.enum],
      };
      expect(validateEffectV1Document(input).ok).toBe(true);
    }
  });
  it.each([null, 3, false, [], "none"])(
    "rejects non-object scene transitions: %j",
    (value) => {
      const { input, scene } = fixture();
      scene.transition = value;
      const result = validateEffectV1Document(input);
      expect(result.ok).toBe(false);
      expect(
        result.diagnostics.some(
          (item) =>
            item.code === "SCENE_TRANSITION" &&
            item.path === "$.scenes[0].transition",
        ),
      ).toBe(true);
    },
  );
  it.each([null, 3, false, [], {}, { ru: "Сцена" }])(
    "rejects malformed scene labels: %j",
    (value) => {
      const { input, scene } = fixture();
      scene.label = value;
      expect(validateEffectV1Document(input).ok).toBe(false);
    },
  );
  it.each(["", "Scene", { ru: "Сцена", en: "Scene" }])(
    "accepts scene labels from the published schema: %j",
    (value) => {
      const { input, scene } = fixture();
      scene.label = value;
      scene.transition = {};
      expect(validateEffectV1Document(input).ok).toBe(true);
    },
  );
});

describe("optional control metadata and graph command boundaries", () => {
  it.each(["color", "text", "number"])(
    "validates numeric metadata for %s controls",
    (kind) => {
      for (const field of ["min", "max", "step"]) {
        for (const value of [null, false, "1", [], {}]) {
          const { input } = fixture();
          const control = responseObject(input, "controls", 0);
          delete control.presentation;
          Object.assign(control, {
            kind,
            defaultValue: kind === "number" ? 1 : "text",
            [field]: value,
          });
          const result = validateEffectV1Document(input);
          expect(result.ok, `${kind}.${field}`).toBe(false);
          expect(
            result.diagnostics.some(
              (item) => item.path === `$.controls[0].${field}`,
            ),
          ).toBe(true);
        }
      }
      const { input } = fixture();
      Object.assign(responseObject(input, "controls", 0), {
        kind,
        defaultValue: kind === "number" ? 1 : "text",
        min: 0,
        max: 2,
        step: 0.1,
      });
      delete responseObject(input, "controls", 0).presentation;
      expect(validateEffectV1Document(input).ok).toBe(true);
      responseObject(input, "controls", 0).step = 0;
      expect(validateEffectV1Document(input).ok).toBe(false);
    },
  );
  it.each([
    ["caret", null],
    ["caret", {}],
    ["reveal", false],
    ["reveal", {}],
    ["text", []],
    ["text", {}],
    ["fontFamily", []],
    ["fontFamily", {}],
    ["fontWeight", []],
    ["fontWeight", {}],
    ["filter", {}],
    ["shadow", {}],
  ])("rejects invalid text command %s: %j", (field, value) => {
    if (typeof field !== "string") throw new Error("Expected field name.");
    const { input } = fixture();
    responseObject(input).controls = [];
    responseObject(input, "program").commands = [
      { op: "text", text: "Hello", x: 0, y: 0, [field]: value },
    ];
    const result = validateEffectV1Document(input);
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (item) =>
          item.path === `$.program.commands[0].${field}` ||
          item.path.startsWith(`$.program.commands[0].${field}.`),
      ),
    ).toBe(true);
  });
  it("accepts scalar and declared text expressions with nonempty style objects", () => {
    const { input } = fixture();
    responseObject(input).controls = [];
    responseObject(input, "program").commands = [
      {
        op: "text",
        text: { op: "read", path: "time" },
        x: 0,
        y: 0,
        fontFamily: "sans-serif",
        fontWeight: 600,
        caret: true,
        reveal: 0.5,
        filter: { blur: 0 },
        shadow: { color: "#000000" },
      },
    ];
    expect(validateEffectV1Document(input).ok).toBe(true);
  });
});
