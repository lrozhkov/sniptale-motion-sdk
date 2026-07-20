import type { SandboxRenderProfile } from "../../../sdk/render-profile.js";

type CanvasFactory = (width: number, height: number) => any;

const PROFILED_METHODS = {
  createLinearGradient: "Gradient",
  createRadialGradient: "Gradient",
  drawImage: "DrawImage",
  fill: "Fill",
  fillRect: "Rect",
  fillText: "Text",
  stroke: "Stroke",
  strokeRect: "Rect",
  strokeText: "Text",
} as const;

export function createCanvasOperationProfiler(
  createCanvas: CanvasFactory,
  profile: SandboxRenderProfile,
) {
  const restores: Array<() => void> = [];
  const contexts = new WeakSet<object>();
  return {
    createCanvas(width: number, height: number) {
      const canvas = createCanvas(width, height);
      const context = canvas.getContext?.("2d");
      if (context && !contexts.has(context)) {
        contexts.add(context);
        instrumentContext(context, profile, restores);
      }
      return canvas;
    },
    restore() {
      while (restores.length > 0) {
        restores.pop()?.();
      }
    },
  };
}

function instrumentContext(
  context,
  profile: SandboxRenderProfile,
  restores: Array<() => void>,
): void {
  for (const [method, category] of Object.entries(PROFILED_METHODS)) {
    const original = context[method];
    if (typeof original !== "function") {
      continue;
    }
    const hadOwn = Object.prototype.hasOwnProperty.call(context, method);
    try {
      context[method] = (...args) => {
        const filtered =
          method === "drawImage" &&
          typeof context.filter === "string" &&
          context.filter !== "none";
        const shadowed =
          Number(context.shadowBlur) > 0 &&
          (method === "drawImage" ||
            method === "fill" ||
            method === "fillRect" ||
            method === "fillText" ||
            method === "stroke" ||
            method === "strokeRect" ||
            method === "strokeText");
        const startedAt = performance.now();
        const result = original.apply(context, args);
        const durationMs = Math.max(0, performance.now() - startedAt);
        recordCanvasOperation(profile, category, durationMs);
        if (filtered) {
          profile.canvasFilteredDrawImageCount += 1;
          profile.canvasFilteredDrawImageMs += durationMs;
        }
        if (shadowed) {
          profile.canvasShadowCount += 1;
          profile.canvasShadowMs += durationMs;
        }
        return result;
      };
      restores.push(() => {
        if (hadOwn) {
          context[method] = original;
        } else {
          delete context[method];
        }
      });
    } catch {
      // Some browser-native context methods may reject instance shadowing.
    }
  }
}

function recordCanvasOperation(
  profile: SandboxRenderProfile,
  category: (typeof PROFILED_METHODS)[keyof typeof PROFILED_METHODS],
  durationMs: number,
): void {
  profile.canvasCallCount += 1;
  profile.canvasTotalMs += durationMs;
  profile[`canvas${category}Count`] += 1;
  profile[`canvas${category}Ms`] += durationMs;
}
