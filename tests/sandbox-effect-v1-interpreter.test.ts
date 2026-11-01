import {
  createDrawingContextFixture,
  createTextMetricsFixture,
} from "./helpers/drawing-context-fixture.js";
import { createNativeBitmapFixture } from "./helpers/native-render-fixtures.js";
import { responseObject } from "../tooling/test/fixtures/response.js";
import type {
  EffectV1Command,
  EffectV1Document,
} from "../src/sdk/effect-v1/types.js";
import type {
  EffectV1EvaluationScope,
  EffectV1EvaluationContext,
} from "../src/apps/sandbox/runtime/effect-v1/expression.js";
import type {
  EffectV1RenderContext,
  RenderState,
} from "../src/apps/sandbox/runtime/effect-v1/model.js";
import type { HydratedSvgPart } from "../src/apps/sandbox/runtime/svg-vector-model.js";
import { readSvgDrawOptions } from "../src/apps/sandbox/runtime/svg-vector-boundary.js";
import { requiredEntry } from "./helpers/required-entry.js";
import { createRuntimeCanvasFixture } from "./helpers/runtime-canvas.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EFFECT_V1_SCHEMA } from "../src/sdk/effect-v1";
import { createEffectV1GraphRenderer } from "../src/apps/sandbox/runtime/effect-v1/interpreter";
import { evaluateEffectV1Expression } from "../src/apps/sandbox/runtime/effect-v1/expression";
import { createBindingReads } from "../src/apps/sandbox/runtime/binding-reads";

describe("sandbox Effect v1 interpreter", () => {
  it("rejects unbranded runtime image inputs before invoking the drawing adapter", async () => {
    const runtime = {
      drawImageAsset:
        vi.fn<NonNullable<RenderState["runtime"]["drawImageAsset"]>>(),
    };
    const document = createDocument([
      { op: "image", input: "source", x: 0, y: 0, width: 10, height: 10 },
    ]);
    document.kind = "targetEffect";
    const renderer = createEffectV1GraphRenderer(document, runtime);
    await expect(
      renderer.renderFrame({
        width: 10,
        height: 10,
        createCanvas: () => createCanvas(10, 10, []),
        inputFrames: { source: { width: 10, height: 10 } },
        track: (_id, fallback) => fallback,
        resolveLayer: () => null,
      }),
    ).rejects.toThrow("native ImageBitmap");
    expect(runtime.drawImageAsset).not.toHaveBeenCalled();
  });

  it("reports an unavailable Canvas 2D context at the frame boundary", async () => {
    const renderer = createEffectV1GraphRenderer(createDocument([]), {});
    await expect(
      renderer.renderFrame({
        width: 10,
        height: 10,
        createCanvas: () => createRuntimeCanvasFixture(null, 10, 10),
        track: (_id, fallback) => fallback,
        resolveLayer: () => null,
      }),
    ).rejects.toThrow("Canvas 2D context is unavailable");
  });
  it.each(["source-atop", "destination-in"] as const)(
    "preserves the agreed %s compositing operation",
    async (blend) => {
      const context = createPassContext();
      const canvas = createRuntimeCanvasFixture(context, 32, 32);
      const renderer = createEffectV1GraphRenderer(
        createDocument([
          {
            op: "fillRect",
            x: 0,
            y: 0,
            width: 32,
            height: 32,
            fill: "#fff",
            blend,
          },
        ]),
        {},
      );
      await renderer.renderFrame({
        canvas,
        createCanvas: () => canvas,
        width: 32,
        height: 32,
        time: 1,
        progress: 0.5,
        controls: {},
        inputFrames: {},
        track: (_id, fallback) => fallback,
        resolveLayer: () => null,
      });
      expect(context.globalCompositeOperation).toBe(blend);
    },
  );

  it("rejects an unsupported blend instead of silently substituting source-over", async () => {
    const context = createPassContext();
    const canvas = createRuntimeCanvasFixture(context, 32, 32);
    const document = createDocument([
      {
        op: "fillRect",
        x: 0,
        y: 0,
        width: 32,
        height: 32,
        fill: "#fff",
        blend: "source-over",
      },
    ]);
    responseObject(document, "program", "commands", 0).blend = "unavailable";
    const renderer = createEffectV1GraphRenderer(document, {});
    await expect(
      renderer.renderFrame({
        createCanvas: () => canvas,
        width: 32,
        height: 32,
        time: 0,
        progress: 0,
        controls: {},
        inputFrames: {},
        track: (_id, fallback) => fallback,
        resolveLayer: () => null,
      }),
    ).rejects.toThrow("Unsupported Effect v1 blend");
  });

  it("reports primitive bounds after graph group and layer transforms", async () => {
    const bindingReads = createBindingReads();
    const context = createGeometryTrackingContext();
    const canvas = createRuntimeCanvasFixture(context, 1280, 720);
    const renderer = createEffectV1GraphRenderer(
      createDocument([
        {
          commands: [
            {
              baseline: "top",
              fontFamily: "system-ui",
              fontSize: 38,
              fontWeight: 720,
              layerId: "title",
              maxWidth: 410,
              op: "text",
              text: "Мария Волкова",
              x: 5,
              y: 6,
            },
            {
              height: 50,
              layerId: "plate",
              op: "shape",
              shape: "roundRect",
              width: 100,
              x: 0,
              y: 0,
            },
          ],
          op: "group",
          x: 100,
          y: 200,
        },
      ]),
      {},
    );

    await renderer.renderFrame({
      __bindingReads: bindingReads,
      assets: {},
      controls: {},
      createCanvas: () => canvas,
      duration: 2,
      frameIndex: 0,
      height: 720,
      inputFrames: {},
      progress: 0,
      resolveLayer: (id: string) =>
        id === "title"
          ? { active: true, opacity: 1, x: -20, y: 10 }
          : { active: true, opacity: 1, x: -30, y: -40 },
      time: 0,
      track: vi.fn<EffectV1EvaluationContext["track"]>(),
      width: 1280,
    });

    expect(bindingReads.primitiveBounds.get("title")).toEqual({
      height: 36,
      layerId: "title",
      width: 160,
      x: 85,
      y: 216,
    });
    expect(bindingReads.primitiveBounds.get("plate")).toEqual({
      height: 50,
      layerId: "plate",
      width: 100,
      x: 70,
      y: 160,
    });
  });

  it("maps render-pass primitive bounds through composite geometry", async () => {
    const bindingReads = createBindingReads();
    const rootContext = createGeometryTrackingContext();
    const passContext = createGeometryTrackingContext();
    const canvases = [
      createRuntimeCanvasFixture(rootContext, 400, 300),
      createRuntimeCanvasFixture(passContext, 100, 100, {
        __sniptaleLogicalHeight: 100,
        __sniptaleLogicalWidth: 100,
      }),
    ];
    const renderer = createEffectV1GraphRenderer(
      createDocument([
        {
          commands: [
            {
              height: 40,
              layerId: "pass-child",
              op: "fillRect",
              fill: "#fff",
              width: 30,
              x: 10,
              y: 20,
            },
          ],
          height: 100,
          id: "card-pass",
          op: "renderPass",
          width: 100,
        },
        {
          height: 200,
          layerId: "pass-output",
          op: "compositePass",
          passId: "card-pass",
          width: 200,
          x: 50,
          y: 60,
        },
      ]),
      {},
    );

    await renderer.renderFrame({
      __bindingReads: bindingReads,
      assets: {},
      controls: {},
      createCanvas: () => {
        const canvas = canvases.shift();
        if (!canvas) throw new Error("Canvas fixtures exhausted.");
        return canvas;
      },
      duration: 2,
      frameIndex: 0,
      height: 300,
      inputFrames: {},
      progress: 0,
      resolveLayer: () => ({ active: true, opacity: 1, x: 0, y: 0 }),
      time: 0,
      track: vi.fn<EffectV1EvaluationContext["track"]>(),
      width: 400,
    });

    expect(bindingReads.primitiveBounds.get("pass-output")).toEqual({
      height: 200,
      layerId: "pass-output",
      width: 200,
      x: 50,
      y: 60,
    });
    expect(bindingReads.primitiveBounds.get("pass-child")).toEqual({
      height: 80,
      layerId: "pass-child",
      width: 60,
      x: 70,
      y: 100,
    });
  });

  it("draws type-owned runtime inputs without evaluating bundle code", async () => {
    const source = createNativeBitmapFixture({ height: 100, width: 200 });
    const runtime = {
      drawImageAsset:
        vi.fn<NonNullable<RenderState["runtime"]["drawImageAsset"]>>(),
      drawSvgVectorAsset:
        vi.fn<NonNullable<RenderState["runtime"]["drawSvgVectorAsset"]>>(),
    };
    const document = createDocument([
      {
        height: 100,
        input: "source",
        op: "image",
        width: 200,
        x: 0,
        y: 0,
      },
    ]);
    document.kind = "targetEffect";
    const renderer = createEffectV1GraphRenderer(document, runtime);
    const canvas = createCanvas(200, 100, []);

    await renderer.renderFrame({
      assets: {},
      controls: {},
      createCanvas: () => canvas,
      duration: 2,
      frameIndex: 0,
      height: 100,
      inputFrames: { source },
      progress: 0,
      resolveLayer: vi
        .fn<EffectV1RenderContext["resolveLayer"]>()
        .mockReturnValue(null),
      time: 0,
      track: vi.fn<EffectV1EvaluationContext["track"]>(),
      width: 200,
    });

    expect(runtime.drawImageAsset).toHaveBeenCalledWith(
      expect.anything(),
      { bitmap: source },
      expect.objectContaining({ alpha: 1, height: 100, width: 200 }),
    );
  });

  it("evaluates custom SVG part transforms in a bounded part scope", async () => {
    const runtime = {
      drawImageAsset:
        vi.fn<NonNullable<RenderState["runtime"]["drawImageAsset"]>>(),
      drawSvgVectorAsset:
        vi.fn<NonNullable<RenderState["runtime"]["drawSvgVectorAsset"]>>(),
    };
    const document = createDocument([
      {
        alpha: 0.5,
        assetId: "logo",
        height: 40,
        op: "svgParts",
        part: {
          alpha: {
            args: [{ op: "read", path: "item.index" }, 0.5],
            op: "add",
          },
          blur: { args: [{ op: "read", path: "item.index" }, 2], op: "mul" },
          kind: "custom",
          originX: { op: "read", path: "item.cx" },
          x: { args: [{ op: "read", path: "item.cx" }, 3], op: "add" },
        },
        width: 100,
        x: 10,
        y: 20,
      },
    ]);
    document.assets = [
      {
        id: "logo",
        kind: "svg",
        mimeType: "image/svg+xml",
        svgText: '<svg xmlns="http://www.w3.org/2000/svg"/>',
      },
    ];
    const renderer = createEffectV1GraphRenderer(document, runtime);
    const canvas = createCanvas(200, 100, []);
    const drawingContext = canvas.getContext("2d");
    if (!drawingContext)
      throw new Error("Missing native drawing context fixture.");
    Object.assign(drawingContext, {
      __sniptaleLogicalScaleX: 3,
      __sniptaleLogicalScaleY: 3,
    });

    await renderer.renderFrame({
      assets: { logo: { svgText: "<svg/>" } },
      controls: {},
      createCanvas: () => canvas,
      duration: 2,
      frameIndex: 0,
      height: 100,
      inputFrames: {},
      progress: 0,
      resolveLayer: vi
        .fn<EffectV1RenderContext["resolveLayer"]>()
        .mockReturnValue(null),
      time: 0,
      track: vi.fn<EffectV1EvaluationContext["track"]>(),
      width: 200,
    });

    const args = readSvgDrawOptions(
      requiredEntry(runtime.drawSvgVectorAsset.mock.calls, 0)[2],
    );
    const part: HydratedSvgPart = {
      type: "rect",
      id: "first",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      rx: 0,
      cx: 11,
      cy: 0,
      opacity: 1,
      fill: "#fff",
      stroke: null,
      strokeWidth: 1,
      strokeLineCap: "butt",
      strokeLineJoin: "miter",
      groupId: null,
      groupIds: [],
    };
    const transform = args.partTransform;
    if (!transform) throw new Error("Missing computed SVG part transform.");
    expect(args.alpha).toBe(1);
    expect(
      transform(part, 1, {
        width: 100,
        height: 40,
        parts: [part, { ...part, id: "second" }],
      }),
    ).toEqual({
      alpha: 1.5,
      filter: "blur(6.00px)",
      originX: 11,
      x: 14,
    });
  });

  it("evaluates bounded numeric, timeline, and geometry expressions", () => {
    const scope: EffectV1EvaluationScope = {
      context: {
        controls: { amplitude: 4 },
        height: 720,
        resolveLayer: vi.fn<EffectV1EvaluationContext["resolveLayer"]>(() => ({
          opacity: 0.75,
        })),
        track: vi.fn<EffectV1EvaluationContext["track"]>(() => 0.5),
        width: 1280,
      },
      definitions: {
        half: { args: [{ op: "read", path: "width" }, 0.5], op: "mul" },
      },
      definitionCache: new Map<string, unknown>(),
      vars: { offset: 12 },
    };

    expect(
      evaluateEffectV1Expression(
        {
          args: [
            { op: "read", path: "defs.half" },
            { op: "read", path: "vars.offset" },
            { op: "read", path: "controls.amplitude" },
          ],
          op: "add",
        },
        scope,
      ),
    ).toBe(656);
    expect(
      evaluateEffectV1Expression(
        {
          args: [
            { args: [0, 0], op: "point" },
            { args: [0, 1], op: "point" },
            { args: [1, 1], op: "point" },
            { args: [1, 0], op: "point" },
            0.5,
          ],
          op: "cubicPoint",
        },
        scope,
      ),
    ).toEqual({ x: 0.5, y: 0.75 });
    expect(
      evaluateEffectV1Expression(
        {
          args: ["Geometria", ", Arial, sans-serif"],
          op: "concat",
        },
        scope,
      ),
    ).toBe("Geometria, Arial, sans-serif");
  });

  it("renders a graph without evaluating bundle code", async () => {
    const operations: string[] = [];
    const runtime = {
      drawImageAsset:
        vi.fn<NonNullable<RenderState["runtime"]["drawImageAsset"]>>(),
      drawSvgVectorAsset:
        vi.fn<NonNullable<RenderState["runtime"]["drawSvgVectorAsset"]>>(),
    };
    const renderer = createEffectV1GraphRenderer(
      createDocument([
        { color: "#02040a", op: "clear" },
        {
          alpha: 0.8,
          blend: "screen",
          commands: [
            {
              fill: { op: "read", path: "controls.accent" },
              height: 100,
              op: "shape",
              radius: 16,
              shape: "roundRect",
              width: 240,
              x: 20,
              y: 30,
            },
            {
              align: "center",
              fill: "#fff",
              fontSize: 32,
              op: "text",
              text: "Safe graph",
              x: 140,
              y: 80,
            },
          ],
          op: "group",
          x: { op: "read", path: "tracks.card.x" },
        },
        {
          commands: [
            {
              fill: "#fff",
              height: 2,
              op: "fillRect",
              width: 2,
              x: { op: "read", path: "vars.i" },
              y: 2,
            },
          ],
          count: 3,
          indexVar: "i",
          op: "forRange",
        },
        {
          from: 2,
          lineWidth: 2,
          op: "sampledPath",
          samples: 4,
          stroke: "#fff",
          to: 5,
          x: { op: "read", path: "vars.sample" },
          y: {
            args: [{ op: "read", path: "vars.sample" }, 2],
            op: "mul",
          },
        },
        {
          fill: "#fff",
          op: "path",
          segments: [
            { kind: "moveTo", x: 0, y: 0 },
            { cpx: 4, cpy: 0, kind: "quadraticTo", x: 4, y: 4 },
            {
              cp1x: 5,
              cp1y: 4,
              cp2x: 6,
              cp2y: 5,
              kind: "cubicTo",
              x: 8,
              y: 8,
            },
          ],
        },
      ]),
      runtime,
    );
    const canvas = createCanvas(320, 180, operations);

    const result = await renderer.renderFrame({
      assets: {},
      controls: { accent: "#5f7cff" },
      createCanvas: () => canvas,
      duration: 2,
      frameIndex: 15,
      height: 180,
      inputFrames: {},
      progress: 0.25,
      resolveLayer: vi.fn<EffectV1RenderContext["resolveLayer"]>(() => ({
        active: true,
        opacity: 1,
        x: 0,
        y: 0,
      })),
      time: 0.5,
      track: vi.fn<EffectV1EvaluationContext["track"]>(() => 12),
      width: 320,
    });

    expect(result).toBe(canvas);
    expect(
      operations.filter((operation) => operation === "fillRect"),
    ).toHaveLength(4);
    expect(operations).toEqual(
      expect.arrayContaining([
        "bezierCurveTo",
        "clearRect",
        "fillText",
        "quadraticCurveTo",
        "roundRect",
      ]),
    );
    expect(runtime.drawImageAsset).not.toHaveBeenCalled();
    expect(operations).toContain("blend:screen");
    expect(operations).not.toContain("blend:source-over");
    expect(
      operations.filter((operation) => operation === "lineTo"),
    ).toHaveLength(3);
  });

  it("clears backing pixels but paints the background in logical coordinates", async () => {
    const calls: Array<{ args: unknown[]; name: string }> = [];
    const context: OffscreenCanvasRenderingContext2D =
      createDrawingContextFixture(3840, 2160);
    context.clearRect = record("clearRect");
    context.fillRect = record("fillRect");
    context.restore = record("restore");
    context.save = record("save");
    context.setTransform = record("setTransform");
    const canvas = createRuntimeCanvasFixture(context, 3840, 2160);
    const renderer = createEffectV1GraphRenderer(
      createDocument([{ color: "#101820", op: "clear" }]),
      {},
    );

    await renderer.renderFrame({
      assets: {},
      controls: {},
      createCanvas: () => canvas,
      duration: 2,
      frameIndex: 0,
      height: 720,
      inputFrames: {},
      progress: 0,
      resolveLayer: vi
        .fn<EffectV1RenderContext["resolveLayer"]>()
        .mockReturnValue(null),
      time: 0,
      track: vi.fn<EffectV1EvaluationContext["track"]>(),
      width: 1280,
    });

    expect(calls).toEqual([
      { args: [0, 0, 1280, 720], name: "clearRect" },
      { args: [], name: "save" },
      { args: [1, 0, 0, 1, 0, 0], name: "setTransform" },
      { args: [0, 0, 3840, 2160], name: "clearRect" },
      { args: [], name: "restore" },
      { args: [], name: "save" },
      { args: [0, 0, 1280, 720], name: "fillRect" },
      { args: [], name: "restore" },
    ]);

    function record(name: string) {
      return (...args: unknown[]): void => {
        calls.push({ args, name });
      };
    }
  });

  it("composites an intermediate backing canvas at its logical size", async () => {
    const rootContext = createPassContext();
    const drawImage = rootContext.drawImage;
    const passContext = createPassContext();
    const rootCanvas = createRuntimeCanvasFixture(rootContext, 3840, 2160, {
      __sniptaleLogicalHeight: 720,
      __sniptaleLogicalWidth: 1280,
    });
    const passCanvas = createRuntimeCanvasFixture(passContext, 3840, 2160, {
      __sniptaleLogicalHeight: 720,
      __sniptaleLogicalWidth: 1280,
    });
    const canvases = [rootCanvas, passCanvas];
    const renderer = createEffectV1GraphRenderer(
      createDocument([
        {
          commands: [
            {
              fill: "#fff",
              height: 720,
              op: "fillRect",
              width: 1280,
              x: 0,
              y: 0,
            },
          ],
          height: 720,
          id: "scene",
          op: "renderPass",
          width: 1280,
        },
        { op: "compositePass", passId: "scene" },
      ]),
      {},
    );

    await renderer.renderFrame({
      assets: {},
      controls: {},
      createCanvas: () => {
        const canvas = canvases.shift();
        if (!canvas) throw new Error("Canvas fixtures exhausted.");
        return canvas;
      },
      duration: 2,
      frameIndex: 0,
      height: 720,
      inputFrames: {},
      progress: 0,
      resolveLayer: vi
        .fn<EffectV1RenderContext["resolveLayer"]>()
        .mockReturnValue(null),
      time: 0,
      track: vi.fn<EffectV1EvaluationContext["track"]>(),
      width: 1280,
    });

    expect(rootContext.translate).toHaveBeenCalledWith(640, 360);
    expect(drawImage).toHaveBeenCalledWith(passCanvas, -640, -360, 1280, 720);
  });

  it("keeps blur and shadow lengths in logical pixels", async () => {
    const context = createPassContext({
      __sniptaleLogicalScaleX: 3,
      __sniptaleLogicalScaleY: 3,
    });
    const canvas = createRuntimeCanvasFixture(context, 3840, 2160, {
      __sniptaleLogicalHeight: 720,
      __sniptaleLogicalWidth: 1280,
    });
    const renderer = createEffectV1GraphRenderer(
      createDocument([
        {
          fill: "#fff",
          filter: { blur: 10 },
          height: 20,
          op: "fillRect",
          shadow: { blur: 8, color: "#000", x: 2, y: 3 },
          width: 20,
          x: 0,
          y: 0,
        },
      ]),
      {},
    );

    await renderer.renderFrame({
      assets: {},
      controls: {},
      createCanvas: () => canvas,
      duration: 2,
      frameIndex: 0,
      height: 720,
      inputFrames: {},
      progress: 0,
      resolveLayer: vi
        .fn<EffectV1RenderContext["resolveLayer"]>()
        .mockReturnValue(null),
      time: 0,
      track: vi.fn<EffectV1EvaluationContext["track"]>(),
      width: 1280,
    });

    expect(context).toMatchObject({
      filter: "blur(30px)",
      shadowBlur: 24,
      shadowOffsetX: 6,
      shadowOffsetY: 9,
    });
  });
});

type LogicalDrawingScale = {
  __sniptaleLogicalScaleX?: number;
  __sniptaleLogicalScaleY?: number;
};
function createPassContext(overrides: LogicalDrawingScale = {}) {
  return Object.assign(createDrawingContextFixture(), overrides);
}

function createDocument(commands: EffectV1Command[]): EffectV1Document {
  return {
    assets: [],
    clips: [],
    controls: [],
    duration: 2,
    id: "safe-graph",
    kind: "standalone",
    label: { en: "Safe graph", ru: "Безопасный граф" },
    layers: [],
    program: { commands, kind: "graph", version: 1 },
    scenes: [{ duration: 2, id: "main", start: 0 }],
    schemaVersion: EFFECT_V1_SCHEMA,
    timeline: { phases: [], tracks: [] },
  };
}

function createCanvas(width: number, height: number, operations: string[]) {
  let composite: GlobalCompositeOperation = "source-over";
  const context: OffscreenCanvasRenderingContext2D =
    createDrawingContextFixture(width, height);
  Object.defineProperty(context, "globalCompositeOperation", {
    get: () => composite,
    set: (value: GlobalCompositeOperation) => {
      composite = value;
      operations.push(`blend:${value}`);
    },
  });
  for (const name of [
    "arc",
    "beginPath",
    "bezierCurveTo",
    "clearRect",
    "clip",
    "closePath",
    "drawImage",
    "ellipse",
    "fill",
    "fillRect",
    "fillText",
    "lineTo",
    "moveTo",
    "quadraticCurveTo",
    "rect",
    "restore",
    "rotate",
    "roundRect",
    "save",
    "scale",
    "setTransform",
    "stroke",
    "translate",
  ] as const)
    context[name] = record(name);
  vi.stubGlobal(
    "CanvasGradient",
    class {
      addColorStop(): void {}
    },
  );
  const gradient = new CanvasGradient();
  vi.spyOn(gradient, "addColorStop").mockImplementation(record("gradientStop"));
  context.createLinearGradient = () => gradient;
  context.createRadialGradient = () => gradient;
  return createRuntimeCanvasFixture(context, width, height);
  function record(name: string): () => void {
    return () => {
      operations.push(name);
    };
  }
}

type Matrix2D = Pick<DOMMatrix, "a" | "b" | "c" | "d" | "e" | "f">;
function createGeometryTrackingContext() {
  let matrix: Matrix2D = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const stack: Matrix2D[] = [];
  const context: OffscreenCanvasRenderingContext2D =
    createDrawingContextFixture();
  vi.stubGlobal(
    "DOMMatrix",
    class {
      a: number;
      b: number;
      c: number;
      d: number;
      e: number;
      f: number;
      constructor(values: number[] = []) {
        this.a = values[0] ?? 1;
        this.b = values[1] ?? 0;
        this.c = values[2] ?? 0;
        this.d = values[3] ?? 1;
        this.e = values[4] ?? 0;
        this.f = values[5] ?? 0;
      }
    },
  );
  context.getTransform = () =>
    new DOMMatrix([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]);
  context.measureText = () => createTextMetricsFixture(160, 28, 8);
  context.restore = () => {
    matrix = stack.pop() ?? matrix;
  };
  context.save = () => {
    stack.push({ ...matrix });
  };
  context.rotate = (angle) => {
    multiply(
      Math.cos(angle),
      Math.sin(angle),
      -Math.sin(angle),
      Math.cos(angle),
      0,
      0,
    );
  };
  context.scale = (x, y) => {
    multiply(x, 0, 0, y, 0, 0);
  };
  context.translate = (x, y) => {
    multiply(1, 0, 0, 1, x, y);
  };
  context.setTransform = (
    transform?: number | DOMMatrix2DInit,
    b?: number,
    c?: number,
    d?: number,
    e?: number,
    f?: number,
  ) => {
    matrix =
      typeof transform === "number"
        ? {
            a: transform,
            b: b ?? 0,
            c: c ?? 0,
            d: d ?? 1,
            e: e ?? 0,
            f: f ?? 0,
          }
        : {
            a: transform?.a ?? 1,
            b: transform?.b ?? 0,
            c: transform?.c ?? 0,
            d: transform?.d ?? 1,
            e: transform?.e ?? 0,
            f: transform?.f ?? 0,
          };
  };
  return context;

  function multiply(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ) {
    matrix = {
      a: matrix.a * a + matrix.c * b,
      b: matrix.b * a + matrix.d * b,
      c: matrix.a * c + matrix.c * d,
      d: matrix.b * c + matrix.d * d,
      e: matrix.a * e + matrix.c * f + matrix.e,
      f: matrix.b * e + matrix.d * f + matrix.f,
    };
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
