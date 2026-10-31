import type { CanvasFactory, RuntimeCanvas } from "./canvas-model.js";
import type { createDirectPreviewPresenter } from "./direct-presentation.js";
type Presenter = Pick<
  ReturnType<typeof createDirectPreviewPresenter>,
  "acquireRenderSurface" | "isRenderSurface"
>;

export function createDirectRenderSurfaceLease(options: {
  cacheRequest: unknown;
  directPresentation: boolean;
  fallback: CanvasFactory;
  height: number;
  presenter: Presenter | null | undefined;
  width: number;
}) {
  let claimed = false;
  let surface: RuntimeCanvas | null = null;
  return {
    createCanvas(width: number, height: number) {
      if (
        !claimed &&
        options.directPresentation &&
        !options.cacheRequest &&
        Math.round(width) === Math.round(options.width) &&
        Math.round(height) === Math.round(options.height)
      ) {
        surface =
          options.presenter?.acquireRenderSurface(
            Math.round(width),
            Math.round(height),
          ) ?? null;
        if (surface) {
          claimed = true;
          return surface;
        }
      }
      return options.fallback(width, height);
    },
    owns(candidate: unknown): candidate is RuntimeCanvas {
      return Boolean(
        surface &&
        candidate === surface &&
        options.presenter?.isRenderSurface(candidate),
      );
    },
  };
}
