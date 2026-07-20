export function resolveThreeRenderSize(
  requestedWidth: number,
  requestedHeight: number,
  viewport: { height?: number; width?: number } | null | undefined,
  dpr: unknown = 1,
) {
  const width = positiveNumber(requestedWidth, 1280);
  const height = positiveNumber(requestedHeight, 720);
  const pixelRatio = positiveNumber(dpr, 1);
  const viewportWidth = positiveNumber(viewport?.width, width * pixelRatio);
  const viewportHeight = positiveNumber(viewport?.height, height * pixelRatio);
  const scale = Math.min(
    1,
    viewportWidth / (width * pixelRatio),
    viewportHeight / (height * pixelRatio),
  );
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

export function shouldBypassThreeRenderForBindingAudit(
  bindingReadMode: unknown,
): boolean {
  return bindingReadMode === "contract";
}

export async function createBindingAuditBitmap(size: {
  height: number;
  width: number;
}) {
  return createImageBitmap(createWebGlCanvas(size.width, size.height));
}

export function createWebGlCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function positiveNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : fallback;
}
