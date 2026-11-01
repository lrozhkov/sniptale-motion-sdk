import { roundRect } from "../../../sdk/canvas-path.js";
import {
  drawCodeBlock,
  drawParticles,
  drawPath,
  drawText,
} from "./canvas-drawing-primitives.js";

import { createSvgPartTransform } from "./svg-part-transform.js";
import { parseSvgAsset } from "./svg-vector-parser.js";
import { drawSvgVectorAsset } from "./svg-vector-renderer.js";
import { drawAssetTrail, drawImageAsset } from "./render-assets.js";
import { recordPrimitivePaintRead } from "./primitive-paint-reads.js";
import { installCanvasRenderQuality } from "./canvas-render-quality.js";
import { getLogicalCanvasSize } from "./logical-canvas.js";
import { createOptionalRuntimeAccess } from "./optional-runtime.js";
import type { createSandboxRegistry } from "./registry.js";
import type { RuntimeCanvas, RuntimeCanvasContext } from "./canvas-model.js";
import type { RuntimeRenderState } from "./runtime-model.js";

export function createSandboxRuntimeFacade(
  registry: ReturnType<typeof createSandboxRegistry>,
) {
  const initialState: RuntimeRenderState = {
    __bindingReads: null,
    __bindingReadMode: null,
    __renderQuality: "full",
    __renderViewport: null,
  };
  const optional = createOptionalRuntimeAccess(
    (): RuntimeRenderState => runtime,
  );
  const runtime = {
    ...initialState,
    clear(canvas: RuntimeCanvas, color?: string): RuntimeCanvasContext {
      const context: RuntimeCanvasContext | null = canvas.getContext("2d");
      if (!context) throw new Error("Canvas 2D context is unavailable.");
      const logicalSize = getLogicalCanvasSize(canvas);
      context.__sniptaleBindingReads = runtime.__bindingReads;
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.restore();
      if (color) {
        context.fillStyle = color;
        context.fillRect(0, 0, logicalSize.width, logicalSize.height);
      }
      return context;
    },
    createCanvas(width: number, height: number): RuntimeCanvas {
      if (typeof OffscreenCanvas !== "undefined")
        return new OffscreenCanvas(width, height);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },
    drawRoundRect: roundRect,
    drawCodeBlock,
    drawMask(
      context: RuntimeCanvasContext,
      drawMaskPath: (context: RuntimeCanvasContext) => void,
      drawContent: (context: RuntimeCanvasContext) => void,
    ): void {
      context.save();
      context.beginPath();
      drawMaskPath(context);
      context.clip();
      drawContent(context);
      context.restore();
    },
    drawParticles: withPrimitiveRead(drawParticles, 0),
    drawImageAsset: withPrimitiveRead(drawImageAsset, 1),
    drawAssetTrail: withPrimitiveRead(drawAssetTrail, 1),
    drawPath: withPrimitiveRead(drawPath, 0),
    drawSvgAsset: withPrimitiveRead(drawImageAsset, 1),
    drawSvgVectorAsset: withPrimitiveRead(
      (context: RuntimeCanvasContext, asset: unknown, args: unknown) =>
        drawSvgVectorAsset(context, asset, args, drawImageAsset),
      1,
    ),
    svgPartTransform: createSvgPartTransform,
    drawText: withPrimitiveRead(drawText, 0),
    parseSvgAsset,
    registerEffect: registry.registerEffect,
    registerComposition: registry.registerComposition,
    get React() {
      return optional.React;
    },
    get THREE() {
      return optional.THREE;
    },
    get r3f() {
      return optional.r3f;
    },
    get three() {
      return optional.three;
    },
    __prepareRuntimeCapabilities: (capabilities: unknown) =>
      optional.prepare(capabilities),
  };
  for (const property of ["React", "THREE", "r3f", "three"]) {
    Object.defineProperty(runtime, property, { configurable: false });
  }
  Object.defineProperty(runtime, "__prepareRuntimeCapabilities", {
    configurable: false,
    enumerable: false,
    writable: false,
  });
  installCanvasRenderQuality(() => runtime.__renderQuality);
  return runtime;
}

function withPrimitiveRead<Args extends unknown[], Result>(
  draw: (context: RuntimeCanvasContext, ...args: Args) => Result,
  optionsIndex: number,
) {
  return (context: RuntimeCanvasContext, ...args: Args): Result => {
    recordPrimitivePaintRead(context, args[optionsIndex]);
    return draw(context, ...args);
  };
}
