import {
  drawCodeBlock,
  drawParticles,
  drawPath,
  drawText,
} from "./canvas-drawing-primitives.js";
import { roundRect } from "./math.js";
import { createSvgPartTransform } from "./svg-part-transform.js";
import { parseSvgAsset } from "./svg-vector-parser.js";
import { drawSvgVectorAsset } from "./svg-vector-renderer.js";
import { drawAssetTrail, drawImageAsset } from "./render-assets.js";
import { recordPrimitivePaintRead } from "./primitive-paint-reads.js";
import { installCanvasRenderQuality } from "./canvas-render-quality.js";
import { getLogicalCanvasSize } from "./logical-canvas.js";

export function createSandboxRuntimeFacade(registry) {
  let reactRuntime: any = null;
  let reactRuntimePromise: Promise<any> | null = null;
  let threeRuntime: any = null;
  let threeRuntimePromise: Promise<any> | null = null;
  const runtime: any = {
    __bindingReads: null,
    __bindingReadMode: null,
    __renderQuality: "full",
    __renderViewport: null,
    clear(canvas, color) {
      const context = canvas.getContext("2d");
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
    createCanvas(width, height) {
      if (typeof OffscreenCanvas !== "undefined") {
        return new OffscreenCanvas(width, height);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },
    drawRoundRect(context, x, y, width, height, radius) {
      roundRect(context, x, y, width, height, radius);
    },
    drawCodeBlock(context, args) {
      drawCodeBlock(context, args);
    },
    drawMask(context, drawMaskPath, drawContent) {
      context.save();
      context.beginPath();
      drawMaskPath(context);
      context.clip();
      drawContent(context);
      context.restore();
    },
    drawParticles(context, args) {
      recordPrimitivePaintRead(context, args);
      drawParticles(context, args);
    },
    drawImageAsset(context, asset, args) {
      recordPrimitivePaintRead(context, args);
      drawImageAsset(context, asset, args);
    },
    drawAssetTrail(context, asset, args) {
      recordPrimitivePaintRead(context, args);
      drawAssetTrail(context, asset, args);
    },
    drawPath(context, args) {
      recordPrimitivePaintRead(context, args);
      drawPath(context, args);
    },
    drawSvgAsset(context, asset, args) {
      recordPrimitivePaintRead(context, args);
      drawImageAsset(context, asset, args);
    },
    drawSvgVectorAsset(context, asset, args) {
      recordPrimitivePaintRead(context, args);
      drawSvgVectorAsset(context, asset, args, drawImageAsset);
    },
    svgPartTransform(args) {
      return createSvgPartTransform(args);
    },
    drawText(context, args) {
      recordPrimitivePaintRead(context, args);
      drawText(context, args);
    },
    parseSvgAsset(asset) {
      return parseSvgAsset(asset);
    },
    registerEffect(definition) {
      registry.registerEffect(definition);
    },
    registerComposition(definition) {
      registry.registerComposition(definition);
    },
  };
  Object.defineProperties(runtime, {
    React: {
      enumerable: true,
      get() {
        return requireOptionalRuntime(reactRuntime, "React", "react");
      },
    },
    THREE: {
      enumerable: true,
      get() {
        return requireOptionalRuntime(threeRuntime?.THREE, "THREE", "three");
      },
    },
    r3f: {
      enumerable: true,
      get() {
        return requireOptionalRuntime(threeRuntime?.r3f, "r3f", "r3f");
      },
    },
    three: {
      enumerable: true,
      get() {
        return requireOptionalRuntime(threeRuntime?.three, "three", "three");
      },
    },
    __prepareRuntimeCapabilities: {
      async value(capabilities: unknown) {
        const values = Array.isArray(capabilities) ? capabilities : [];
        const needsR3f = values.includes("r3f");
        const pending: Promise<any>[] = [];
        if ((values.includes("react") || needsR3f) && !reactRuntime) {
          reactRuntimePromise ??= import("./react-facade.js").then((module) =>
            module.createReactFacade(),
          );
          pending.push(
            reactRuntimePromise.then((value) => {
              reactRuntime = value;
            }),
          );
        }
        if ((values.includes("three") || needsR3f) && !threeRuntime) {
          threeRuntimePromise ??= import("./three-facade.js").then((module) =>
            module.createThreeSandboxFacade({
              getBindingReadMode: () => runtime.__bindingReadMode,
              getRenderViewport: () => runtime.__renderViewport,
            }),
          );
          pending.push(
            threeRuntimePromise.then((value) => {
              threeRuntime = value;
            }),
          );
        }
        try {
          await Promise.all(pending);
        } catch (error) {
          if (!reactRuntime) {
            reactRuntimePromise = null;
          }
          if (!threeRuntime) {
            threeRuntimePromise = null;
          }
          throw error;
        }
      },
    },
  });
  installCanvasRenderQuality(() => runtime.__renderQuality);
  return runtime;
}

function requireOptionalRuntime(
  value: any,
  property: string,
  capability: string,
) {
  if (value) {
    return value;
  }
  throw new Error(
    `Runtime.${property} requires the ${capability} module capability.`,
  );
}
