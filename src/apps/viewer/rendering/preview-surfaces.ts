export function syncDirectPreviewSurface(
  canvas: HTMLCanvasElement,
  fastPreviewCanvas: HTMLCanvasElement,
  width: unknown,
  height: unknown,
  previewCanvas?: HTMLCanvasElement,
): void {
  const renderWidth = String(
    typeof width === "number" && Number.isFinite(width)
      ? Math.max(1, width)
      : 1,
  );
  const renderHeight = String(
    typeof height === "number" && Number.isFinite(height)
      ? Math.max(1, height)
      : 1,
  );
  if (canvas.dataset.renderWidth !== renderWidth) {
    canvas.dataset.renderWidth = renderWidth;
  }
  if (canvas.dataset.renderHeight !== renderHeight) {
    canvas.dataset.renderHeight = renderHeight;
  }
  syncPreviewSurfaceVisibility(
    fastPreviewCanvas,
    canvas,
    "direct",
    previewCanvas,
  );
}

export function syncPreviewSurfaceVisibility(
  fastPreviewCanvas: Pick<HTMLCanvasElement, "hidden">,
  directPreviewCanvas: Pick<HTMLCanvasElement, "hidden">,
  activeSurface: "direct" | "fast" | "none",
  previewCanvas?: Pick<HTMLCanvasElement, "style">,
): void {
  const fastHidden = activeSurface !== "fast";
  const directHidden = activeSurface !== "direct";
  if (fastPreviewCanvas.hidden !== fastHidden) {
    fastPreviewCanvas.hidden = fastHidden;
  }
  if (directPreviewCanvas.hidden !== directHidden) {
    directPreviewCanvas.hidden = directHidden;
  }
  if (previewCanvas) {
    const opacity = activeSurface === "none" ? "1" : "0";
    if (previewCanvas.style.opacity !== opacity) {
      previewCanvas.style.opacity = opacity;
    }
  }
}
