import { describe, expect, it, vi } from "vitest";
import {
  EFFECT_V1_SCHEMA,
  mapEffectV1ObjectPoint,
  mapEffectV1ScenePoint,
  resolveEffectV1ObjectRenderBounds,
  validateEffectV1Document,
  normalizeEffectV1ToTemplate,
  type EffectV1ObjectLayout,
} from "../src/sdk/effect-v1";
import { buildEffectFilePayload } from "../src/apps/viewer/effect-file/builder";
import { applyEffectV1ObjectLayout } from "../src/apps/sandbox/runtime/effect-v1/object-layout";

const layout: EffectV1ObjectLayout = {
  width: 380,
  height: 160,
  resize: "scale",
  handles: [
    {
      id: "tip",
      label: { ru: "Конец", en: "Tip" },
      xControl: "tx",
      yControl: "ty",
      padding: 8,
    },
  ],
};
function document() {
  return {
    schemaVersion: EFFECT_V1_SCHEMA,
    id: "callout",
    kind: "standalone",
    duration: 2,
    label: { ru: "Выноска", en: "Callout" },
    description: { ru: "Описание", en: "Description" },
    objectLayout: structuredClone(layout),
    assets: [],
    layers: [],
    clips: [],
    scenes: [{ id: "main", start: 0, duration: 2 }],
    timeline: { phases: [], tracks: [] },
    controls: ["tx", "ty"].map((id) => ({
      id,
      kind: "number",
      min: -1000000,
      max: 1000000,
      defaultValue: 100,
    })),
    program: {
      kind: "graph",
      version: 1,
      commands: [
        {
          op: "fillRect",
          x: { op: "read", path: "controls.tx" },
          y: { op: "read", path: "controls.ty" },
          width: 4,
          height: 4,
          fill: "#fff",
        },
      ],
    },
  };
}

describe("external object handles", () => {
  it("keeps selection dimensions while extending raster bounds in every direction", () => {
    expect(
      resolveEffectV1ObjectRenderBounds(layout, { tx: 600, ty: -100 }),
    ).toEqual({ x: 0, y: -108, width: 608, height: 268 });
    expect(
      resolveEffectV1ObjectRenderBounds(layout, { tx: -200, ty: 400 }),
    ).toEqual({ x: -208, y: 0, width: 588, height: 408 });
    expect(
      resolveEffectV1ObjectRenderBounds(layout, { tx: 100, ty: 100 }),
    ).toEqual({ x: 0, y: 0, width: 380, height: 160 });
    expect(layout.width).toBe(380);
    expect(() =>
      resolveEffectV1ObjectRenderBounds(layout, { tx: NaN, ty: 1 }),
    ).toThrow();
    expect(() =>
      resolveEffectV1ObjectRenderBounds(layout, { tx: 1000001, ty: 1 }),
    ).toThrow();
    expect(() =>
      resolveEffectV1ObjectRenderBounds(
        { ...layout, handles: [{ ...layout.handles![0], padding: -1 }] },
        { tx: 1, ty: 1 },
      ),
    ).toThrow();
  });

  it.each([0, Math.PI / 2, -0.7])(
    "preserves a scene anchor across moving, scaling and rotating the card (%s)",
    (rotation) => {
      const scene = { x: 1910, y: 12 };
      for (const placement of [
        { x: 70, y: 300, width: 760, height: 320, rotation },
        { x: 500, y: 30, width: 190, height: 80, rotation: rotation + 0.2 },
      ]) {
        const local = mapEffectV1ScenePoint(layout, placement, scene);
        const restored = mapEffectV1ObjectPoint(layout, placement, local);
        expect(restored.x).toBeCloseTo(scene.x, 8);
        expect(restored.y).toBeCloseTo(scene.y, 8);
      }
      expect(() =>
        mapEffectV1ScenePoint(
          layout,
          { x: NaN, y: 0, width: 380, height: 160, rotation: 0 },
          scene,
        ),
      ).toThrow();
    },
  );

  it("validates and preserves handles and edited coordinates through export", () => {
    const result = validateEffectV1Document(document());
    expect(result.ok).toBe(true);
    const exported = buildEffectFilePayload({
      template: normalizeEffectV1ToTemplate(result.document!),
      assets: new Map(),
      controlValues: { tx: -300, ty: 500 },
    });
    expect(exported.objectLayout).toEqual(layout);
    expect(validateEffectV1Document(exported).ok).toBe(true);
    expect(exported.controls[0].defaultValue).toBe(-300);
  });

  it.each([
    null,
    [],
    Array(9).fill(layout.handles![0]),
    [{ ...layout.handles![0], xControl: "missing" }],
    [{ ...layout.handles![0], yControl: "tx" }],
    [{ ...layout.handles![0], padding: 257 }],
    [{ ...layout.handles![0], extra: 1 }],
    [layout.handles![0], layout.handles![0]],
  ])("rejects malformed handle declarations", (handles) => {
    const doc = document();
    expect(
      validateEffectV1Document({
        ...doc,
        objectLayout: { ...doc.objectLayout, handles },
      }).ok,
    ).toBe(false);
  });

  it("rejects reflow handles and unbounded coordinate controls", () => {
    const doc = document();
    expect(
      validateEffectV1Document({
        ...doc,
        objectLayout: { ...doc.objectLayout, resize: "reflow" },
      }).ok,
    ).toBe(false);
    delete (doc.controls[0] as { min?: number }).min;
    expect(validateEffectV1Document(doc).ok).toBe(false);
  });

  it("renders external content in an expanded viewport without changing graph body dimensions", () => {
    const c = {
      translate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
    };
    const result = applyEffectV1ObjectLayout(
      layout,
      { width: 608, height: 268, controls: { tx: 600, ty: -100 } },
      c,
    );
    expect(result).toMatchObject({ width: 380, height: 160 });
    expect(c.translate).toHaveBeenCalledWith(0, 108);
    expect(c.scale).toHaveBeenCalledWith(1, 1);
    expect(c.rect).toHaveBeenCalledWith(0, -108, 608, 268);
  });
});
