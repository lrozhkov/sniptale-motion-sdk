import type { SandboxRenderProfile } from "../../../sdk/render-profile.js";

type ProfileCanvas = { getContext?: (kind: "2d") => unknown };

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

export function createCanvasOperationProfiler<Canvas extends ProfileCanvas>(
  createCanvas: (width: number, height: number) => Canvas,
  profile: SandboxRenderProfile,
) {
  const restores: Array<() => void> = [];
  const contexts = new WeakSet<object>();
  return {
    createCanvas(width: number, height: number) {
      const canvas = createCanvas(width, height);
      const context = canvas.getContext?.("2d");
      if (context && typeof context === "object" && !contexts.has(context)) {
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
  context: object,
  profile: SandboxRenderProfile,
  restores: Array<() => void>,
): void {
  for (const [method, category] of Object.entries(PROFILED_METHODS)) {
    const original: unknown = Reflect.get(context, method);
    if (typeof original !== "function") {
      continue;
    }
    const hadOwn = Object.prototype.hasOwnProperty.call(context, method);
    try {
      const instrumented = (...args: unknown[]): unknown => {
        const filter: unknown = Reflect.get(context, "filter");
        const shadowBlur: unknown = Reflect.get(context, "shadowBlur");
        const filtered =
          method === "drawImage" &&
          typeof filter === "string" &&
          filter !== "none";
        const shadowed =
          typeof shadowBlur === "number" &&
          shadowBlur > 0 &&
          (method === "drawImage" ||
            method === "fill" ||
            method === "fillRect" ||
            method === "fillText" ||
            method === "stroke" ||
            method === "strokeRect" ||
            method === "strokeText");
        const startedAt = performance.now();
        const result: unknown = Reflect.apply(original, context, args);
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
      if (!Reflect.set(context, method, instrumented)) continue;
      restores.push(() => {
        if (hadOwn) {
          Reflect.set(context, method, original);
        } else {
          Reflect.deleteProperty(context, method);
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
