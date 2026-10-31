import { requireEffectV1Fixture } from "../tooling/test/fixtures/effect-v1-documents.ts";
import { requiredEntry } from "./helpers/required-entry";
import { expect, it } from "vitest";
import { validateEffectV1Controls } from "../src/sdk/effect-v1/scene-validation.js";
import { validateLocaleText } from "../src/sdk/effect-v1/validation-shared.js";
function report() {
  const errors: string[] = [];
  const warnings: string[] = [];
  return {
    errors,
    warnings,
    error(code: string) {
      errors.push(code);
    },
    warning(code: string) {
      warnings.push(code);
    },
  };
}
it("accepts grouped enum controls and English-only labels", () => {
  const r = report();
  validateEffectV1Controls(
    [
      {
        id: "mode",
        kind: "text",
        defaultValue: "a",
        group: "animation",
        order: 0,
        options: [
          { value: "a", label: { en: "First" } },
          { value: "b", label: { en: "Second" } },
        ],
      },
    ],
    r,
  );
  validateLocaleText(
    { en: "Title", "zh-Hant-TW": "Title" },
    "$.label",
    true,
    r,
  );
  expect(r.errors).toEqual([]);
  expect(r.warnings).toEqual([]);
});
it("rejects invalid enum types and preserves unknown group diagnostics", () => {
  const r = report();
  validateEffectV1Controls(
    [
      {
        id: "mode",
        kind: "number",
        defaultValue: 0,
        group: "future",
        options: [
          { value: "x", label: { en: "X" } },
          { value: 1, label: { ru: "Only Russian" } },
        ],
      },
    ],
    r,
  );
  expect(r.errors).toEqual(
    expect.arrayContaining([
      "CONTROL_OPTION_VALUE",
      "LOCALE_EN_REQUIRED",
      "CONTROL_OPTION_DEFAULT",
    ]),
  );
  expect(r.warnings).toEqual(["CONTROL_GROUP_UNKNOWN"]);
});

import {
  resolveEffectV1LocaleText,
  normalizeEffectV1ToTemplate,
  validateEffectV1Document,
} from "../src/sdk/effect-v1/index.js";
import { buildEffectFilePayload } from "../src/apps/viewer/effect-file/builder.js";

it("resolves exact, base and English metadata without translating user text", () => {
  const labels = { en: "English", pt: "Base", "pt-BR": "Regional" };
  expect(resolveEffectV1LocaleText(labels, "pt-br")).toBe("Regional");
  expect(resolveEffectV1LocaleText(labels, "pt-PT")).toBe("Base");
  expect(resolveEffectV1LocaleText(labels, "de-DE")).toBe("English");
  expect(resolveEffectV1LocaleText(labels, "bad_tag")).toBe("English");
  expect(resolveEffectV1LocaleText({ en: "English", ru: "" }, "ru")).toBe(
    "English",
  );
});

it.each([
  { group: "bad group" },
  { order: -1 },
  { order: 0.5 },
  { order: Number.MAX_SAFE_INTEGER + 1 },
  { options: [] },
  {
    options: [
      { value: 0, label: { en: "A" } },
      { value: 0, label: { en: "B" } },
    ],
  },
  {
    options: [
      { value: -1, label: { en: "A" } },
      { value: 0, label: { en: "B" } },
    ],
  },
  {
    options: [
      { value: 0, label: { en: " " } },
      { value: 1, label: { en: "B" } },
    ],
  },
  {
    options: [
      { value: 0, label: { en: "A" }, html: "bad" },
      { value: 1, label: { en: "B" } },
    ],
  },
])("rejects malformed presentation %j", (patch) => {
  const r = report();
  validateEffectV1Controls(
    [{ id: "mode", kind: "number", min: 0, max: 1, defaultValue: 0, ...patch }],
    r,
  );
  expect(r.errors.length).toBeGreaterThan(0);
});

it.each(["en_US", "en-toooolong", "en--US", "en-u", "123", "x"])(
  "rejects invalid portable locale %s",
  (locale) => {
    const r = report();
    validateLocaleText(
      { en: "Fallback", [locale]: "Text" },
      "$.label",
      false,
      r,
    );
    expect(r.errors).toContain("LOCALE_ENTRY");
  },
);

it("preserves presentation and English-only handles through normalization, copying and edited export", () => {
  const control = {
    id: "mode",
    kind: "number",
    defaultValue: 0,
    min: 0,
    max: 1,
    group: "animation",
    order: 3,
    label: { en: "Order" },
    options: [
      { value: 0, label: { en: "First" } },
      { value: 1, label: { en: "Together", "pt-BR": "Juntos" } },
    ],
  };
  const source = {
    schemaVersion: "sniptale.effect.v1",
    id: "presentation-proof",
    kind: "standalone",
    duration: 4,
    label: { en: "Annotation" },
    assets: [],
    layers: [],
    clips: [],
    scenes: [{ id: "main", start: 0, duration: 4 }],
    timeline: { phases: [], tracks: [] },
    controls: [
      control,
      { id: "x", kind: "number", min: -1000, max: 1000, defaultValue: 120 },
      { id: "y", kind: "number", min: -1000, max: 1000, defaultValue: -20 },
    ],
    objectLayout: {
      width: 100,
      height: 50,
      resize: "scale",
      handles: [
        {
          id: "tip",
          label: { en: "Target", "zh-Hant-TW": "目標" },
          xControl: "x",
          yControl: "y",
          padding: 8,
        },
      ],
    },
    program: {
      kind: "graph",
      version: 1,
      commands: [
        {
          op: "fillRect",
          x: { op: "read", path: "controls.x" },
          y: { op: "read", path: "controls.y" },
          width: 10,
          height: 10,
          fill: "#fff",
          alpha: { op: "read", path: "controls.mode" },
        },
      ],
    },
  };
  const result = validateEffectV1Document(source);
  expect(result.ok).toBe(true);
  const template = normalizeEffectV1ToTemplate(requireEffectV1Fixture(source));
  const copied = structuredClone(template);
  const exported = requireEffectV1Fixture(
    buildEffectFilePayload({
      template: copied,
      assets: new Map(),
      controlValues: { mode: 1 },
    }),
  );
  expect(requiredEntry(exported.controls, 0)).toEqual({
    ...control,
    defaultValue: 1,
  });
  expect(exported.objectLayout).toEqual(source.objectLayout);
  expect(exported).not.toHaveProperty("description");
  expect(validateEffectV1Document(exported).ok).toBe(true);
  expect(requiredEntry(source.controls, 0).defaultValue).toBe(0);
  expect(template.controls?.[0]?.defaultValue).toBe(0);
});

import { isEffectV1LocaleTag } from "../src/sdk/effect-v1/locale-tags.js";
it.each([
  "x-private",
  "zh-cmn-Hans-CN",
  "i-klingon",
  "en-US-u-ca-gregory",
  "de-CH-1901",
])("accepts well-formed BCP47 %s", (tag) => {
  expect(isEffectV1LocaleTag(tag)).toBe(true);
  expect(
    resolveEffectV1LocaleText({ en: "Fallback", [tag]: "Exact" }, tag),
  ).toBe("Exact");
});
it.each(["en-US-US", "de-1901-1901", "en-u-ca-gregory-u-nu-latn"])(
  "rejects malformed or duplicate subtags %s",
  (tag) => expect(isEffectV1LocaleTag(tag)).toBe(false),
);

import { resolveEffectV1ControlDefault } from "../src/sdk/effect-v1/index.js";
import { buildControlsWithDefaults } from "../src/apps/viewer/editor/model.js";
import type { ControlDefinition } from "../src/sdk/types.js";
const localizedText: ControlDefinition = {
  id: "title",
  kind: "text",
  defaultValue: "Original",
  localizedDefaultValue: {
    en: "Title",
    ru: "Заголовок",
    pt: "Título",
    "pt-BR": "Título regional",
  },
};
it.each([
  ["ru-RU", "Заголовок"],
  ["pt-br", "Título regional"],
  ["pt-PT", "Título"],
  ["de", "Title"],
  ["bad_tag", "Title"],
])("initializes text for %s", (locale, expected) => {
  expect(resolveEffectV1ControlDefault(localizedText, locale)).toBe(expected);
  expect(localizedText.defaultValue).toBe("Original");
});
it("retains literal defaults when localization is absent and does not localize numbers or colors", () => {
  for (const c of [
    { id: "t", kind: "text", defaultValue: "" },
    { id: "n", kind: "number", defaultValue: 0 },
    { id: "c", kind: "color", defaultValue: "#fff" },
  ] as ControlDefinition[]) {
    expect(resolveEffectV1ControlDefault(c, "ru")).toBe(c.defaultValue);
  }
});
it.each([
  [{ ru: "Заголовок" }, "text", "LOCALE_EN_REQUIRED"],
  [{ en: " " }, "text", "LOCALE_EN_REQUIRED"],
  [{ en: 1 }, "text", "LOCALE_EN_REQUIRED"],
  [{ en: "Title", ru: 1 }, "text", "LOCALE_ENTRY"],
  [{ en: "Title", en_US: "Title" }, "text", "LOCALE_ENTRY"],
  ["Title", "text", "LOCALE_TEXT"],
  [null, "text", "LOCALE_TEXT"],
  [{ en: "Title" }, "number", "CONTROL_LOCALIZED_DEFAULT_KIND"],
  [{ en: "Title" }, "color", "CONTROL_LOCALIZED_DEFAULT_KIND"],
])("rejects malformed localized defaults %j on %s", (value, kind, code) => {
  const r = report();
  validateEffectV1Controls(
    [
      {
        ...localizedText,
        kind,
        defaultValue: kind === "number" ? 0 : "Original",
        localizedDefaultValue: value,
      },
    ],
    r,
  );
  expect(r.errors).toContain(code);
});
it("checks localized defaults against text option values", () => {
  const r = report();
  validateEffectV1Controls(
    [
      {
        ...localizedText,
        options: [
          { value: "Original", label: { en: "Original" } },
          { value: "Title", label: { en: "Title" } },
        ],
      },
    ],
    r,
  );
  expect(r.errors).toContain("CONTROL_OPTION_LOCALIZED_DEFAULT");
});
it.each(["My edited title", "", "Title"])(
  "preserves saved text %j through copy and export without locale resolution",
  (value) => {
    const doc = {
      schemaVersion: "sniptale.effect.v1",
      id: "localized-default",
      kind: "standalone",
      duration: 4,
      label: { en: "Localized text" },
      assets: [],
      layers: [],
      clips: [],
      scenes: [{ id: "main", start: 0, duration: 4 }],
      timeline: { phases: [], tracks: [] },
      controls: [localizedText],
      program: {
        kind: "graph",
        version: 1,
        commands: [
          {
            op: "text",
            text: { op: "read", path: "controls.title" },
            x: 20,
            y: 20,
            fontSize: 16,
            fill: "#fff",
          },
        ],
      },
    };
    const template = normalizeEffectV1ToTemplate(requireEffectV1Fixture(doc));
    const controls = { title: value };
    const copied = structuredClone(controls);
    expect(buildControlsWithDefaults(template, copied)).toEqual(controls);
    const exported = requireEffectV1Fixture(
      buildEffectFilePayload({
        template,
        assets: new Map(),
        controlValues: copied,
      }),
    );
    expect(requiredEntry(exported.controls, 0).defaultValue).toBe(value);
    const textControl = requiredEntry(exported.controls, 0);
    if (textControl.kind !== "text")
      throw new Error("Expected the exported text control.");
    expect(textControl.localizedDefaultValue).toEqual(
      localizedText.localizedDefaultValue,
    );
    const validation = validateEffectV1Document(exported);
    expect(validation.ok).toBe(true);
    if (!validation.document)
      throw new Error("Exported control document is invalid.");
    const restored = normalizeEffectV1ToTemplate(validation.document);
    expect(buildControlsWithDefaults(restored)).toEqual(controls);
    expect(localizedText.defaultValue).toBe("Original");
  },
);
