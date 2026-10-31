import type { RuntimeCanvas, RuntimeCanvasContext } from "./canvas-model.js";

export type DirectPreviewSurface = RuntimeCanvas;
type PresentationContext =
  | { kind: "2d"; value: RuntimeCanvasContext }
  | { kind: "bitmaprenderer"; value: ImageBitmapRenderingContext };

export function isDirectPreviewSurface(
  value: unknown,
): value is DirectPreviewSurface {
  return (
    (typeof OffscreenCanvas !== "undefined" &&
      value instanceof OffscreenCanvas) ||
    (typeof HTMLCanvasElement !== "undefined" &&
      value instanceof HTMLCanvasElement)
  );
}

export function createDirectPreviewPresenter() {
  let context: PresentationContext | null = null;
  let surface: DirectPreviewSurface | null = null;
  return {
    canPresentReusableBitmap(): boolean {
      return context?.kind === "2d";
    },
    acquireRenderSurface(
      width: number,
      height: number,
    ): DirectPreviewSurface | null {
      if (!surface || context?.kind !== "2d") return null;
      syncSurfaceSize(surface, width, height);
      return surface;
    },
    commitRenderSurface(candidate: unknown): boolean {
      if (!surface || context?.kind !== "2d" || candidate !== surface)
        return false;
      const target = context.value;
      if ("commit" in target && typeof target.commit === "function") {
        const result: unknown = Reflect.apply(target.commit, target, []);
        void Promise.resolve(result).catch(() => {});
      }
      return true;
    },
    connect(nextSurface: unknown): boolean {
      context = isDirectPreviewSurface(nextSurface)
        ? getPreviewSurfaceContext(nextSurface)
        : null;
      surface =
        context && isDirectPreviewSurface(nextSurface) ? nextSurface : null;
      return context !== null;
    },
    isRenderSurface(candidate: unknown): boolean {
      return Boolean(
        surface && context?.kind === "2d" && candidate === surface,
      );
    },
    present(
      bitmap: ImageBitmap,
      options: { reusable?: boolean } = {},
    ): boolean {
      if (!surface || !context) return false;
      syncSurfaceSize(surface, bitmap.width, bitmap.height);
      if (context.kind === "bitmaprenderer") {
        context.value.transferFromImageBitmap(bitmap);
      } else {
        context.value.clearRect(0, 0, surface.width, surface.height);
        context.value.drawImage(bitmap, 0, 0);
        if (options.reusable !== true) bitmap.close();
      }
      return true;
    },
  };
}
function syncSurfaceSize(
  surface: DirectPreviewSurface,
  width: number,
  height: number,
): void {
  if (surface.width !== width) surface.width = width;
  if (surface.height !== height) surface.height = height;
}
function getPreviewSurfaceContext(
  surface: DirectPreviewSurface,
): PresentationContext | null {
  try {
    const value = surface.getContext("2d", { desynchronized: true });
    if (value) return { kind: "2d", value };
  } catch {
    /* Try the supported fallback context. */
  }
  try {
    const value = surface.getContext("bitmaprenderer");
    if (value) return { kind: "bitmaprenderer", value };
  } catch {
    /* This surface cannot present frames. */
  }
  return null;
}
