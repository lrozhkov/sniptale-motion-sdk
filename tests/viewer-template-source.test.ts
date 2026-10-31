import { isEditorLayer } from "../src/apps/viewer/layers/source.js";
import { createStarterDocument } from "../src/apps/cli/starter.js";
import { normalizeEffectV1ToTemplate } from "../src/sdk/effect-v1/index.js";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { ViewerAppContext } from "../src/apps/viewer/app/context.js";
import type { EditorTemplate } from "../src/apps/viewer/templates/model.js";
import {
  readEditorTemplate,
  readEditorPresets,
  readTemplatePatch,
  readTemplateSource,
} from "../src/apps/viewer/templates/source.js";
import { readEditorTimeline } from "../src/apps/viewer/editor/timeline-source.js";
import {
  isLayerGroup,
  createLayerHierarchyIndex,
} from "../src/apps/viewer/layers/hierarchy.js";

function source() {
  return {
    id: "tiny",
    duration: 0.02,
    label: { ru: "Короткий эффект", en: "Short effect" },
    layers: [
      {
        id: "title",
        type: "text",
        x: 0,
        extension: { keep: true },
        editor: {
          canvas: "bounds",
          transform: ["x", "y"],
          operations: ["duplicate"],
          properties: ["text"],
        },
      },
    ],
    clips: [{ layerId: "title", start: 0.001, duration: 0.019 }],
    scenes: [
      {
        id: "main",
        start: 0.001,
        duration: 0.019,
        label: { en: "Intro", ru: "Вступление" },
      },
    ],
    controls: [
      {
        id: "zero",
        kind: "number",
        defaultValue: 0,
        min: 0,
        max: 1,
        step: 0.01,
        order: 0,
        label: { en: "Zero" },
        options: [{ value: 0, label: "Zero" }],
      },
    ],
    assets: ["mark"],
    presets: [
      {
        id: 12,
        duration: 0.02,
        scenes: [
          {
            id: "main",
            start: 0.001,
            duration: 0.019,
            label: { en: "Intro", ru: "Вступление" },
          },
        ],
        timeline: { extension: "opaque" },
        extension: { keep: true },
      },
    ],
    extension: [false, 0, ""],
  };
}
const timeline = readEditorTimeline({ phases: [], tracks: [] }, 0.02);

describe("effective template source boundary", () => {
  it("exposes a typed template while retained documents and extensions remain unknown", () => {
    expectTypeOf<
      ReturnType<ViewerAppContext["getEffectiveTemplate"]>
    >().toEqualTypeOf<EditorTemplate | null>();
    expectTypeOf<EditorTemplate["effectV1"]>().toBeUnknown();
    expectTypeOf<
      ReturnType<ViewerAppContext["getEditorOverride"]>
    >().toEqualTypeOf<Record<string, unknown>>();
    expectTypeOf<
      Parameters<ViewerAppContext["setEditorOverride"]>[0]
    >().toBeUnknown();
    expectTypeOf<EditorTemplate["controls"]>().not.toBeAny();
  });

  it.each(["standalone", "targetEffect", "transition"] as const)(
    "accepts the canonical SDK %s template without changing its retained document",
    (kind) => {
      const document = createStarterDocument("canonical", kind);
      const template = normalizeEffectV1ToTemplate(document);
      const parsed = readEditorTemplate(
        template,
        readEditorTimeline(template.timeline, template.duration),
      );
      expect(parsed.id).toBe(document.id);
      expect(parsed.effectV1).toEqual(document);
      expect(parsed.controls).toEqual(document.controls);
    },
  );

  it("preserves source timing, zero defaults, raw presets and extensions", () => {
    const raw = source();
    const before = structuredClone(raw);
    const parsed = readEditorTemplate(raw, timeline);
    expect(parsed).toEqual({ ...before, timeline });
    expect(raw).toEqual(before);
    expect(parsed.controls?.[0]?.defaultValue).toBe(0);
    expect(parsed.clips[0]?.start).toBe(0.001);
    expect(parsed.clips[0]?.duration).toBe(0.019);
  });

  it("projects legacy preset identity without normalizing its timing or discarding extensions", () => {
    const raw = source();
    const before = structuredClone(raw.presets);
    const presets = readEditorPresets(raw.presets);
    expect(presets[0]).toMatchObject({
      id: "12",
      duration: 0.02,
      scenes: before[0]?.scenes,
      timeline: before[0]?.timeline,
      extension: { keep: true },
    });
    expect(raw.presets).toEqual(before);
    const partial = readEditorPresets([
      {
        id: "controls-only",
        label: "Readable",
        controls: { x: 0 },
        extra: false,
      },
    ]);
    expect(partial[0]).toEqual({
      id: "controls-only",
      label: "Readable",
      controls: { x: 0 },
      extra: false,
    });
    expect(partial[0]).not.toHaveProperty("duration");
    expect(partial[0]).not.toHaveProperty("scenes");
  });

  it("skips malformed preset entries without rewriting the source list", () => {
    const raw = [null, 12, {}, { id: "" }, { id: "valid", controls: false }];
    expect(readEditorPresets(raw)).toMatchObject([
      { id: "valid", controls: {} },
    ]);
    expect(raw).toEqual([
      null,
      12,
      {},
      { id: "" },
      { id: "valid", controls: false },
    ]);
  });

  it.each([
    { layers: [null] },
    { layers: [{ id: "a" }] },
    { layers: [{ id: "a", type: "group", parentId: [] }] },
    { layers: [{ id: "a", type: "group", editor: { canvas: "execute" } }] },
    { layers: [{ id: "a", type: "group", editor: { operations: [false] } }] },
    { layers: [{ id: "a", type: "group", editor: { transform: ["script"] } }] },
    { clips: [{ layerId: "title", start: "0", duration: 1 }] },
    { scenes: [{ id: "s", start: 0, duration: 1, locked: 1 }] },
    { controls: [{ id: "c" }] },
    { controls: [{ id: "c", defaultValue: 0, min: "0" }] },
    { controls: [{ id: "c", defaultValue: 0, options: [{ value: {} }] }] },
    { assets: [false] },
    { moduleId: {} },
    { label: { en: {} } },
    { presets: false },
  ])("rejects malformed known fields: %j", (patch) => {
    expect(() =>
      readEditorTemplate({ ...source(), ...patch }, timeline),
    ).toThrow(/Invalid effective editor template/);
  });

  it("keeps hierarchy identity separate from full SDK layer validation", () => {
    expect(isLayerGroup({ type: "group" })).toBe(false);
    expect(isEditorLayer({ id: "g", type: "group", locked: "yes" })).toBe(
      false,
    );
    expect(isLayerGroup({ id: "g", type: "group" })).toBe(true);
    const nodes = [
      { id: "g", type: "group" },
      { id: "child", type: "rect", parentId: "g" },
    ];
    const index = createLayerHierarchyIndex([
      ...nodes,
      { id: "partial" },
      { id: 12 },
      null,
    ]);
    expect([...index.byId.keys()]).toEqual(["g", "child", "partial"]);
  });

  it.each([null, [], 12, "source", { id: 0 }])(
    "rejects an unparsed source identity: %j",
    (raw) => {
      expect(() => readTemplateSource(raw)).toThrow(
        /Invalid editor template source/,
      );
    },
  );

  it.each([null, [], 12, "patch"])(
    "rejects a non-record override: %j",
    (raw) => {
      expect(() => readTemplatePatch(raw)).toThrow(
        /Invalid editor template override/,
      );
    },
  );
});
