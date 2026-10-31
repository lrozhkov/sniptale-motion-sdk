import { expect, it } from "vitest";
import {
  validateEffectV1Document,
  normalizeEffectV1ToTemplate,
  applyEffectV1ControlPreset,
  applyEffectV1ControlPresetValues,
  validateEffectV1ControlPresetValues,
  resolveEffectV1ControlDefault,
} from "../src/sdk/effect-v1/index.js";
import type { EffectV1Document } from "../src/sdk/effect-v1/types.js";
import { buildEffectFilePayload } from "../src/apps/viewer/effect-file/builder.js";
function source(): EffectV1Document {
  return {
    schemaVersion: "sniptale.effect.v1",
    id: "styled",
    kind: "standalone",
    duration: 4,
    label: { en: "Styled" },
    assets: [],
    layers: [],
    clips: [],
    scenes: [{ id: "main", start: 0, duration: 4 }],
    timeline: { phases: [], tracks: [] },
    controls: [
      { id: "ink", kind: "color", defaultValue: "#fff", group: "appearance" },
      {
        id: "title",
        kind: "text",
        defaultValue: "Title",
        localizedDefaultValue: { en: "Title", ru: "Заголовок" },
        group: "content",
      },
      {
        id: "size",
        kind: "number",
        defaultValue: 16,
        min: 8,
        max: 32,
        group: "typography",
        options: [
          { value: 16, label: { en: "Small" } },
          { value: 24, label: { en: "Large" } },
        ],
      },
      {
        id: "x",
        kind: "number",
        defaultValue: 20,
        min: -100,
        max: 100,
        group: "appearance",
      },
      {
        id: "y",
        kind: "number",
        defaultValue: 30,
        min: -1000,
        max: 1000,
        group: "geometry",
      },
    ],
    objectLayout: {
      width: 100,
      height: 50,
      resize: "scale",
      handles: [
        {
          id: "point",
          padding: 8,
          label: { en: "Point" },
          xControl: "x",
          yControl: "y",
        },
      ],
    },
    controlPresets: [
      {
        id: "orange-dark",
        label: { en: "Dark" },
        theme: { id: "orange", label: { en: "Orange" } },
        style: { id: "dark", label: { en: "Dark" } },
        values: { ink: "#fff", size: 16 },
      },
      {
        id: "orange-light",
        label: { en: "Light" },
        theme: { id: "orange", label: { en: "Orange" } },
        style: { id: "light", label: { en: "Light" } },
        values: { ink: "#111", size: 24 },
      },
    ],
    defaultControlPresetId: "orange-dark",
    program: {
      kind: "graph",
      version: 1,
      commands: [
        {
          op: "text",
          text: { op: "read", path: "controls.title" },
          x: { op: "read", path: "controls.x" },
          y: { op: "read", path: "controls.y" },
          fontSize: { op: "read", path: "controls.size" },
          fill: { op: "read", path: "controls.ink" },
        },
      ],
    },
  };
}
it("accepts named visual presets and preserves them through edited export", () => {
  const doc = source();
  expect(
    validateEffectV1Document(doc).diagnostics.filter(
      (d) => d.severity === "error",
    ),
  ).toEqual([]);
  const template = normalizeEffectV1ToTemplate(doc);
  const exported = buildEffectFilePayload({
    template,
    assets: new Map(),
    controlValues: { title: "Edited", ink: "#123456" },
  });
  expect(exported.controlPresets).toEqual(doc.controlPresets);
  expect(exported.defaultControlPresetId).toBe(doc.defaultControlPresetId);
  expect(validateEffectV1Document(exported).ok).toBe(true);
  expect(exported.controls[1].localizedDefaultValue).toEqual({
    en: "Title",
    ru: "Заголовок",
  });
  expect(exported.controls[1].defaultValue).toBe("Edited");
});
it.each(["ru", "en"])(
  "applies new-instance style after localizing %s without changing text or handles",
  (locale) => {
    const doc = source();
    const controls = Object.fromEntries(
      doc.controls.map((c) => [c.id, resolveEffectV1ControlDefault(c, locale)]),
    );
    const initial = applyEffectV1ControlPreset(doc, controls, "orange-light");
    expect(initial.title).toBe(locale === "ru" ? "Заголовок" : "Title");
    expect(initial.ink).toBe("#111");
    const edited: Record<string, string | number> = {
      ...initial,
      title: "",
      x: -75,
      y: 800,
    };
    const changed = applyEffectV1ControlPreset(doc, edited, "orange-dark");
    expect(changed).toEqual({ ...edited, ink: "#fff", size: 16 });
    expect(edited.ink).toBe("#111");
  },
);
it("preserves opaque instance controls when applying validated visual values", () => {
  const current: Record<string, unknown> = {
    title: "Keep",
    flag: false,
    extension: { retained: true },
  };
  const before = structuredClone(current);
  expect(applyEffectV1ControlPreset(source(), current, "orange-dark")).toEqual({
    ...before,
    ink: "#fff",
    size: 16,
  });
  expect(current).toEqual(before);
  expect(() =>
    applyEffectV1ControlPresetValues(source(), current, { ink: false }),
  ).toThrow();
});
it.each([
  [null, "CONTROL_PRESET_VALUES"],
  [{}, "CONTROL_PRESET_VALUES"],
  [[], "CONTROL_PRESET_VALUES"],
  [{ missing: 1 }, "CONTROL_PRESET_CONTROL"],
  [{ title: "overwrite" }, "CONTROL_PRESET_PROTECTED"],
  [{ x: 25 }, "CONTROL_PRESET_PROTECTED"],
  [{ y: 25 }, "CONTROL_PRESET_PROTECTED"],
  [{ ink: 12 }, "CONTROL_PRESET_VALUE"],
  [{ size: 40 }, "CONTROL_PRESET_VALUE"],
  [{ size: NaN }, "CONTROL_PRESET_VALUE"],
  [{ size: "16" }, "CONTROL_PRESET_VALUE"],
  [{ size: 20 }, "CONTROL_PRESET_OPTION"],
  [{ "bad id": 1 }, "IDENTIFIER"],
  [JSON.parse('{"__proto__":{"polluted":true}}'), "IDENTIFIER"],
])("rejects unsafe user visual overrides %j", (values, code) => {
  const doc = source();
  expect(
    validateEffectV1ControlPresetValues(doc, values).diagnostics.map(
      (d) => d.code,
    ),
  ).toContain(code);
  expect(() =>
    applyEffectV1ControlPresetValues(doc, { title: "Keep" }, values),
  ).toThrow();
});
it("applies validated user visual overrides and rejects unknown built-in preset IDs", () => {
  const doc = source();
  expect(
    applyEffectV1ControlPresetValues(
      doc,
      { title: "Keep", ink: "#000" },
      { ink: "#abc" },
    ),
  ).toEqual({ title: "Keep", ink: "#abc" });
  expect(() => applyEffectV1ControlPreset(doc, {}, "unknown")).toThrow();
});
it.each([
  [
    (d: any) => {
      d.controlPresets = [];
    },
    "CONTROL_PRESETS",
  ],
  [
    (d: any) => {
      delete d.controlPresets;
    },
    "CONTROL_PRESETS",
  ],
  [
    (d: any) => {
      delete d.defaultControlPresetId;
    },
    "CONTROL_PRESET_DEFAULT",
  ],
  [
    (d: any) => {
      d.defaultControlPresetId = "missing";
    },
    "CONTROL_PRESET_DEFAULT",
  ],
  [
    (d: any) => {
      d.controlPresets[1].id = d.controlPresets[0].id;
    },
    "CONTROL_PRESET_DUPLICATE",
  ],
  [
    (d: any) => {
      d.controlPresets[0].label = { ru: "Тема" };
    },
    "LOCALE_EN_REQUIRED",
  ],
  [
    (d: any) => {
      d.controlPresets[0].theme.id = "bad id";
    },
    "IDENTIFIER",
  ],
  [
    (d: any) => {
      d.controlPresets[0].theme = null;
    },
    "CONTROL_PRESET_IDENTITY",
  ],
  [
    (d: any) => {
      d.controlPresets[0].theme.html = "bad";
    },
    "UNKNOWN_FIELD",
  ],
  [
    (d: any) => {
      d.controlPresets[1].theme.label = { en: "Other" };
    },
    "CONTROL_PRESET_IDENTITY_CONFLICT",
  ],
  [
    (d: any) => {
      d.controlPresets[0].run = "code";
    },
    "UNKNOWN_FIELD",
  ],
  [
    (d: any) => {
      d.controlPresets[0] = null;
    },
    "CONTROL_PRESET",
  ],
  [
    (d: any) => {
      d.controlPresets[0].values = { title: "Bad" };
    },
    "CONTROL_PRESET_PROTECTED",
  ],
  [
    (d: any) => {
      delete d.controls[0].group;
    },
    "CONTROL_PRESET_PROTECTED",
  ],
])("rejects invalid preset contract", (mutate, code) => {
  const d = source();
  mutate(d);
  expect(validateEffectV1Document(d).diagnostics.map((x) => x.code)).toContain(
    code,
  );
});
