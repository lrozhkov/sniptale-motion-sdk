export type DirectPreviewSurface = {
  getContext(
    type: "2d" | "bitmaprenderer",
    options?: { desynchronized?: boolean },
  ): any;
  height: number;
  width: number;
};

type DirectPreviewPresentOptions = {
  reusable?: boolean;
};

export function createDirectPreviewPresenter() {
  let context: any = null;
  let contextType: "2d" | "bitmaprenderer" | null = null;
  let surface: DirectPreviewSurface | null = null;

  return {
    canPresentReusableBitmap(): boolean {
      return contextType === "2d";
    },
    acquireRenderSurface(width: number, height: number) {
      if (!surface || !context || contextType !== "2d") {
        return null;
      }
      syncSurfaceSize(surface, width, height);
      return surface;
    },
    commitRenderSurface(candidate: unknown): boolean {
      if (
        !surface ||
        !context ||
        contextType !== "2d" ||
        candidate !== surface
      ) {
        return false;
      }
      context.commit?.();
      return true;
    },
    connect(nextSurface: DirectPreviewSurface): boolean {
      const canvasContext = getPreviewSurfaceContext(nextSurface, "2d");
      const nextContext =
        canvasContext ??
        getPreviewSurfaceContext(nextSurface, "bitmaprenderer");
      if (!nextContext) {
        context = null;
        contextType = null;
        surface = null;
        return false;
      }
      context = nextContext;
      contextType = canvasContext ? "2d" : "bitmaprenderer";
      surface = nextSurface;
      return true;
    },
    isRenderSurface(candidate: unknown): boolean {
      return Boolean(surface && contextType === "2d" && candidate === surface);
    },
    present(
      bitmap: ImageBitmap,
      options: DirectPreviewPresentOptions = {},
    ): boolean {
      if (!surface || !context) {
        return false;
      }
      syncSurfaceSize(surface, bitmap.width, bitmap.height);
      if (contextType === "bitmaprenderer") {
        context.transferFromImageBitmap(bitmap);
      } else {
        context.clearRect(0, 0, surface.width, surface.height);
        context.drawImage(bitmap, 0, 0);
        if (options.reusable !== true) {
          bitmap.close?.();
        }
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
  if (surface.width !== width) {
    surface.width = width;
  }
  if (surface.height !== height) {
    surface.height = height;
  }
}

function getPreviewSurfaceContext(
  surface: DirectPreviewSurface,
  type: "2d" | "bitmaprenderer",
): any {
  try {
    return surface.getContext(
      type,
      type === "2d" ? { desynchronized: true } : undefined,
    );
  } catch {
    return null;
  }
}
