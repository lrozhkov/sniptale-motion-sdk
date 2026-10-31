type GraphInverse = Pick<DOMMatrixReadOnly, "a" | "b" | "c" | "d" | "e" | "f">;
export type GraphPointerSurface = {
  getBoundingClientRect(): Pick<
    DOMRectReadOnly,
    "left" | "top" | "width" | "height"
  >;
  viewBox: { baseVal: Pick<SVGRect, "width" | "height"> };
  getScreenCTM?(): { inverse(): GraphInverse } | null;
};
type PointerCoordinates = Pick<MouseEvent, "clientX" | "clientY">;

export function getGraphPointer(
  svg: GraphPointerSurface,
  event: PointerCoordinates,
) {
  return createGraphPointerMapper(svg)(event);
}

export function createGraphPointerMapper(svg: GraphPointerSurface) {
  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  const metrics = {
    height: viewBox.height,
    left: rect.left,
    top: rect.top,
    width: viewBox.width,
    viewportHeight: rect.height,
    viewportWidth: rect.width,
  };
  const inverse = readInverse(svg);
  const validMetrics = Object.values(metrics).every(Number.isFinite);
  return (event: PointerCoordinates): { x: number; y: number } | null => {
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY))
      return null;
    if (!inverse && !validMetrics) return null;
    const point = inverse
      ? {
          x: inverse.a * event.clientX + inverse.c * event.clientY + inverse.e,
          y: inverse.b * event.clientX + inverse.d * event.clientY + inverse.f,
        }
      : {
          x:
            ((event.clientX - metrics.left) /
              Math.max(1, metrics.viewportWidth)) *
            metrics.width,
          y:
            ((event.clientY - metrics.top) /
              Math.max(1, metrics.viewportHeight)) *
            metrics.height,
        };
    return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
  };
}

function readInverse(svg: GraphPointerSurface): GraphInverse | null {
  try {
    const inverse = svg.getScreenCTM?.()?.inverse() ?? null;
    return inverse &&
      [inverse.a, inverse.b, inverse.c, inverse.d, inverse.e, inverse.f].every(
        Number.isFinite,
      )
      ? inverse
      : null;
  } catch {
    return null;
  }
}

export function readGraphPointerTarget(
  event: Event,
): { target: SVGElement; svg: SVGSVGElement } | null {
  const target = event.currentTarget;
  if (!(target instanceof SVGElement)) return null;
  const svg = target instanceof SVGSVGElement ? target : target.ownerSVGElement;
  return svg ? { target, svg } : null;
}
