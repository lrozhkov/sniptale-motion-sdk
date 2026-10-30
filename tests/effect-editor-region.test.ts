import { expect, it } from "vitest";
import {
  resolveEffectV1EditorRegion,
  updateEffectV1EditorRegion,
  validateEffectV1Document,
  normalizeEffectV1ToTemplate,
} from "../src/sdk/effect-v1/index.js";
import type { EffectV1Document } from "../src/sdk/effect-v1/types.js";
import { buildEffectFilePayload } from "../src/apps/viewer/effect-file/builder.js";
function source(): EffectV1Document {
  return {
    schemaVersion: "sniptale.effect.v1",
    id: "focus",
    kind: "targetEffect",
    label: { en: "Focus" },
    duration: 4,
    assets: [],
    layers: [],
    clips: [],
    scenes: [{ id: "main", start: 0, duration: 4 }],
    timeline: { phases: [], tracks: [] },
    controls: [
      {
        id: "x",
        kind: "number",
        group: "geometry",
        defaultValue: 50,
        min: 0,
        max: 100,
      },
      {
        id: "y",
        kind: "number",
        group: "geometry",
        defaultValue: 50,
        min: 0,
        max: 100,
      },
      {
        id: "w",
        kind: "number",
        group: "geometry",
        defaultValue: 52,
        min: 12,
        max: 88,
      },
      {
        id: "h",
        kind: "number",
        group: "geometry",
        defaultValue: 38,
        min: 12,
        max: 80,
      },
    ],
    editorRegion: {
      id: "focus",
      label: { en: "Focus" },
      kind: "rect",
      units: "percent",
      position: "available-space",
      inset: 16 / 720,
      xControl: "x",
      yControl: "y",
      widthControl: "w",
      heightControl: "h",
    },
    program: {
      kind: "graph",
      version: 1,
      commands: [
        {
          op: "image",
          input: "source",
          x: { op: "read", path: "controls.x" },
          y: { op: "read", path: "controls.y" },
          width: { op: "read", path: "controls.w" },
          height: { op: "read", path: "controls.h" },
        },
      ],
    },
  };
}
it("validates and roundtrips the region separately from instance geometry", () => {
  const doc = source();
  expect(validateEffectV1Document(doc).ok).toBe(true);
  const out = buildEffectFilePayload({
    template: normalizeEffectV1ToTemplate(doc),
    assets: new Map(),
    controlValues: { x: 17, y: 32, w: 64, h: 24 },
  });
  expect(out.editorRegion).toEqual(doc.editorRegion);
  expect(validateEffectV1Document(out).ok).toBe(true);
  expect(out.controls[0].defaultValue).toBe(17);
});
it.each([
  { width: 1280, height: 720 },
  { width: 720, height: 1280 },
  { width: 720, height: 720 },
  { width: 1440, height: 900 },
])("roundtrips travel and dimensions for %j", (size) => {
  const doc = source();
  for (const controls of [
    { x: 0, y: 100, w: 12, h: 80 },
    { x: 50, y: 50, w: 52, h: 38 },
    { x: 73.25, y: 21.5, w: 87.25, h: 71.125 },
  ]) {
    const rect = resolveEffectV1EditorRegion(doc, controls, size)!;
    const patch = updateEffectV1EditorRegion(doc, controls, rect, size);
    for (const key of Object.keys(controls))
      expect(patch[key]).toBeCloseTo(controls[key], 9);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(size.width);
  }
});
it("clamps off-frame moves and oversized resize, returning only four geometry controls", () => {
  const doc = source(),
    current = { x: 20, y: 30, w: 52, h: 38, title: "Keep", accent: "#fff" };
  const patch = updateEffectV1EditorRegion(
    doc,
    current,
    { x: -100, y: 2000, width: 5000, height: 5000 },
    { width: 1280, height: 720 },
  );
  expect(patch).toEqual({ w: 88, h: 80, x: 0, y: 100 });
  expect(current.title).toBe("Keep");
  expect(Object.keys(patch).sort()).toEqual(["h", "w", "x", "y"]);
});
it("handles zero travel and rejects non-finite inputs", () => {
  const doc = source();
  doc.editorRegion!.inset = 0;
  if (doc.controls[2].kind === "number") doc.controls[2].max = 100;
  if (doc.controls[3].kind === "number") doc.controls[3].max = 100;
  expect(
    updateEffectV1EditorRegion(
      doc,
      { x: 37, y: 81 },
      { x: 0, y: 0, width: 100, height: 100 },
      { width: 100, height: 100 },
    ),
  ).toEqual({ x: 37, y: 81, w: 100, h: 100 });
  expect(() =>
    resolveEffectV1EditorRegion(doc, {}, { width: 0, height: 100 }),
  ).toThrow();
  expect(() =>
    resolveEffectV1EditorRegion(doc, { x: NaN }, { width: 100, height: 100 }),
  ).toThrow();
  expect(() =>
    updateEffectV1EditorRegion(
      doc,
      {},
      { x: 0, y: 0, width: -1, height: 1 },
      { width: 100, height: 100 },
    ),
  ).toThrow();
  delete doc.editorRegion;
  expect(
    resolveEffectV1EditorRegion(doc, {}, { width: 100, height: 100 }),
  ).toBeNull();
  expect(() =>
    updateEffectV1EditorRegion(
      doc,
      {},
      { x: 0, y: 0, width: 1, height: 1 },
      { width: 100, height: 100 },
    ),
  ).toThrow();
});
it.each([
  [
    (d: any) => {
      d.editorRegion = null;
    },
    "EDITOR_REGION",
  ],
  [
    (d: any) => {
      d.kind = "standalone";
    },
    "EDITOR_REGION_KIND",
  ],
  [
    (d: any) => {
      d.editorRegion.xControl = "missing";
    },
    "EDITOR_REGION_CONTROL",
  ],
  [
    (d: any) => {
      d.editorRegion.xControl = "y";
    },
    "EDITOR_REGION_DUPLICATE",
  ],
  [
    (d: any) => {
      d.editorRegion.inset = 0.3;
    },
    "EDITOR_REGION_INSET",
  ],
  [
    (d: any) => {
      d.editorRegion.units = "pixels";
    },
    "EDITOR_REGION_COORDINATES",
  ],
  [
    (d: any) => {
      d.editorRegion.extra = 1;
    },
    "UNKNOWN_FIELD",
  ],
  [
    (d: any) => {
      d.editorRegion.label = { ru: "Фокус" };
    },
    "LOCALE_EN_REQUIRED",
  ],
  [
    (d: any) => {
      d.controls[0].group = "appearance";
    },
    "EDITOR_REGION_CONTROL",
  ],
  [
    (d: any) => {
      d.controls[2].min = 0;
    },
    "EDITOR_REGION_CONTROL",
  ],
  [
    (d: any) => {
      d.controls[2].max = 100;
    },
    "EDITOR_REGION_CONTROL",
  ],
  [
    (d: any) => {
      d.controls[0].options = [
        { value: 0, label: { en: "Zero" } },
        { value: 50, label: { en: "Center" } },
      ];
    },
    "EDITOR_REGION_CONTROL",
  ],
])("rejects invalid region metadata", (mutate, code) => {
  const doc = source();
  mutate(doc);
  expect(
    validateEffectV1Document(doc).diagnostics.map((d) => d.code),
  ).toContain(code);
});
