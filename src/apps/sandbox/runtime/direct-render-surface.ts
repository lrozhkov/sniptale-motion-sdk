type CanvasFactory = (width: number, height: number) => any;

export function createDirectRenderSurfaceLease(options: {
  cacheRequest: unknown;
  directPresentation: boolean;
  fallback: CanvasFactory;
  height: number;
  presenter: any;
  width: number;
}) {
  let claimed = false;
  let surface: any = null;
  return {
    createCanvas(width: number, height: number) {
      if (
        !claimed &&
        options.directPresentation &&
        !options.cacheRequest &&
        Math.round(width) === Math.round(options.width) &&
        Math.round(height) === Math.round(options.height)
      ) {
        surface = options.presenter.acquireRenderSurface(
          Math.round(width),
          Math.round(height),
        );
        if (surface) {
          claimed = true;
          return surface;
        }
      }
      return options.fallback(width, height);
    },
    owns(candidate: unknown): boolean {
      return Boolean(
        surface &&
        candidate === surface &&
        options.presenter.isRenderSurface(candidate),
      );
    },
  };
}
