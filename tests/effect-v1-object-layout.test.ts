import { createRuntimeCanvasFixture } from "./helpers/runtime-canvas.js";
import { describe, expect, it, vi } from "vitest";
import {
  EFFECT_V1_SCHEMA,
  normalizeEffectV1ToTemplate,
  resolveEffectV1ObjectLayout,
  validateEffectV1Document,
  type EffectV1Document,
  type EffectV1ObjectLayout,
} from "../src/sdk/effect-v1";
import { buildEffectFilePayload } from "../src/apps/viewer/effect-file/builder";
import { createEffectV1GraphRenderer } from "../src/apps/sandbox/runtime/effect-v1/interpreter";

const layout: EffectV1ObjectLayout = {
  width: 400,
  height: 100,
  resize: "scale",
};
function document(): EffectV1Document {
  return {
    schemaVersion: EFFECT_V1_SCHEMA,
    id: "local-card",
    kind: "standalone",
    label: { ru: "Карточка", en: "Card" },
    duration: 2,
    description: { ru: "Локальный объект", en: "Local object" },
    assets: [],
    controls: [],
    layers: [],
    clips: [],
    scenes: [{ id: "main", start: 0, duration: 2 }],
    timeline: { phases: [], tracks: [] },
    objectLayout: { ...layout },
    program: {
      kind: "graph",
      version: 1,
      commands: [
        {
          op: "fillRect",
          x: 0,
          y: 0,
          fill: "#fff",
          width: { op: "read", path: "width" },
          height: { op: "read", path: "height" },
        },
      ],
    },
  };
}

describe("standalone object layout", () => {
  it("survives validation, normalization and export without changing legacy documents", () => {
    const original = document();
    expect(validateEffectV1Document(original).ok).toBe(true);
    const template = normalizeEffectV1ToTemplate(original);
    const exported = buildEffectFilePayload({ template, assets: new Map() });
    expect(exported.objectLayout).toEqual(layout);
    expect(validateEffectV1Document(exported).ok).toBe(true);
    if (
      exported.objectLayout === null ||
      typeof exported.objectLayout !== "object" ||
      !("width" in exported.objectLayout)
    )
      throw new Error("Exported object layout is absent.");
    exported.objectLayout.width = 17;
    expect(original.objectLayout?.width).toBe(400);
    delete original.objectLayout;
    expect(validateEffectV1Document(original).ok).toBe(true);
    expect(
      buildEffectFilePayload({
        template: normalizeEffectV1ToTemplate(original),
        assets: new Map(),
      }),
    ).not.toHaveProperty("objectLayout");
  });

  it.each([
    null,
    [],
    {},
    { ...layout, width: 0 },
    { ...layout, height: Infinity },
    { ...layout, width: 20000 },
    { ...layout, height: 0.5 },
    { ...layout, width: "400" },
    { ...layout, resize: "stretch" },
    { ...layout, padding: 50 },
  ])("rejects malformed or unbounded geometry: %j", (value) => {
    expect(
      validateEffectV1Document({ ...document(), objectLayout: value }).ok,
    ).toBe(false);
  });

  it.each(["targetEffect", "transition"])(
    "rejects object placement for %s",
    (kind) => {
      const result = validateEffectV1Document({ ...document(), kind });
      expect(
        result.diagnostics.some((d) => d.code === "OBJECT_LAYOUT_KIND"),
      ).toBe(true);
    },
  );

  it("fits scale objects without distortion and allows independent reflow dimensions", () => {
    expect(resolveEffectV1ObjectLayout(layout)).toEqual({
      width: 400,
      height: 100,
    });
    expect(
      resolveEffectV1ObjectLayout(layout, { width: 100, height: 100 }),
    ).toEqual({ width: 100, height: 25 });
    expect(
      resolveEffectV1ObjectLayout(layout, { width: 1200, height: 200 }),
    ).toEqual({ width: 800, height: 200 });
    expect(
      resolveEffectV1ObjectLayout(
        { ...layout, resize: "reflow" },
        { width: 1200, height: 200 },
      ),
    ).toEqual({ width: 1200, height: 200 });
    expect(() =>
      resolveEffectV1ObjectLayout(layout, { width: NaN, height: 100 }),
    ).toThrow();
    expect(() =>
      resolveEffectV1ObjectLayout({ ...layout, resize: "bad" } as never),
    ).toThrow();
  });

  it.each(["scale", "reflow", undefined] as const)(
    "renders %s with the appropriate logical coordinate system",
    async (resize) => {
      const doc = document();
      if (resize) doc.objectLayout!.resize = resize;
      else delete doc.objectLayout;
      const c = {
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        beginPath: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
      };
      const canvas = createRuntimeCanvasFixture(c, 800, 400);
      const renderer = createEffectV1GraphRenderer(doc, {});
      for (const time of [0, 1, 2, 1]) {
        await renderer.renderFrame({
          width: 800,
          height: 400,
          time,
          progress: time / 2,
          createCanvas: () => canvas,
          track: (_id, fallback) => fallback,
          controls: {},
          resolveLayer: () => null,
        });
      }
      expect(c.fillRect).toHaveBeenLastCalledWith(
        0,
        0,
        resize === "scale" ? 400 : 800,
        resize === "scale" ? 100 : 400,
      );
      if (resize === "scale") {
        expect(c.scale).toHaveBeenCalledWith(2, 2);
        expect(c.translate).toHaveBeenCalledWith(0, 100);
      } else if (resize === "reflow") {
        expect(c.scale).toHaveBeenCalledWith(1, 1);
        expect(c.translate).toHaveBeenCalledWith(0, 0);
      } else expect(c.scale).not.toHaveBeenCalled();
    },
  );
});
