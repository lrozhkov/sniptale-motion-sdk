import type { ViewerAppContext } from "../app/context.js";

const DEFERRED_INTERACTIVE_RENDER_DELAY_MS = 120;

export function activateCanvasDrag(
  ctx: ViewerAppContext,
  distance: number,
  startCommand: () => void,
  threshold = 2,
): boolean {
  if (ctx.state.dragMoved) {
    return true;
  }
  if (distance <= threshold) {
    return false;
  }
  ctx.state.dragMoved = true;
  startCommand();
  return true;
}

type CanvasTransformPreviewOptions = {
  box: any;
  layer: any;
  layerId: string;
};

export function projectCanvasTransformPreviewBox({ box, next, original }) {
  const resolved = { ...original, ...next };
  const originalScaleX = Math.max(0.05, Number(original.scaleX) || 1);
  const originalScaleY = Math.max(0.05, Number(original.scaleY) || 1);
  const nextScaleX = Math.max(0.05, Number(resolved.scaleX) || 1);
  const nextScaleY = Math.max(0.05, Number(resolved.scaleY) || 1);
  const baseWidth = box.width / originalScaleX;
  const baseHeight = box.height / originalScaleY;
  const originalAnchorX = 0.5 + (Number(original.anchorX) || 0);
  const originalAnchorY = 0.5 + (Number(original.anchorY) || 0);
  const nextAnchorX = 0.5 + (Number(resolved.anchorX) || 0);
  const nextAnchorY = 0.5 + (Number(resolved.anchorY) || 0);
  return {
    height: baseHeight * nextScaleY,
    rotation: Number(resolved.rotation) || 0,
    width: baseWidth * nextScaleX,
    x:
      box.x +
      ((Number(resolved.x) || 0) - (Number(original.x) || 0)) +
      baseWidth *
        (nextAnchorX * (1 - nextScaleX) -
          originalAnchorX * (1 - originalScaleX)),
    y:
      box.y +
      ((Number(resolved.y) || 0) - (Number(original.y) || 0)) +
      baseHeight *
        (nextAnchorY * (1 - nextScaleY) -
          originalAnchorY * (1 - originalScaleY)),
  };
}

export function createCanvasDragPreview(
  ctx: ViewerAppContext,
  options: CanvasTransformPreviewOptions | null = null,
) {
  let frame = 0;
  let deferredRender: ReturnType<typeof setTimeout> | null = null;
  let pendingUpdate: (() => void) | null = null;
  ctx.state.canvasTransformDragActive = true;
  if (options) {
    const anchor = ctx.getResolvedLayerAnchor(options.layer);
    ctx.state.canvasTransformPreview = {
      awaitingFullRender: false,
      box: { ...options.box },
      initialBox: { ...options.box },
      layerId: options.layerId,
      original: {
        anchorX: anchor.x,
        anchorY: anchor.y,
        rotation: ctx.getResolvedLayerProperty(options.layer, "rotation"),
        scaleX: ctx.getResolvedLayerProperty(options.layer, "scaleX"),
        scaleY: ctx.getResolvedLayerProperty(options.layer, "scaleY"),
        x: ctx.getResolvedLayerProperty(options.layer, "x"),
        y: ctx.getResolvedLayerProperty(options.layer, "y"),
      },
      templateId: ctx.state.currentTemplate?.id ?? null,
    };
  }
  ctx.refs.canvasSelectionBox.dataset.transforming = "true";
  return {
    finalize(finalUpdate: (() => void) | null = null) {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      if (deferredRender) {
        clearTimeout(deferredRender);
        deferredRender = null;
      }
      pendingUpdate = null;
      try {
        finalUpdate?.();
      } finally {
        ctx.state.canvasTransformDragActive = false;
        if (ctx.state.canvasTransformPreview) {
          if (ctx.state.dragMoved) {
            ctx.state.canvasTransformPreview.awaitingFullRender = true;
          } else {
            ctx.state.canvasTransformPreview = null;
          }
        }
        delete ctx.refs.canvasSelectionBox.dataset.transforming;
      }
    },
    scheduleUpdate(update: () => void) {
      pendingUpdate = update;
      if (frame) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        const applyUpdate = pendingUpdate;
        pendingUpdate = null;
        applyUpdate?.();
        if (ctx.state.previewCacheEnabled === false) {
          void ctx.renderCurrentFrame({ interactive: true });
          return;
        }
        if (deferredRender) {
          clearTimeout(deferredRender);
        }
        deferredRender = globalThis.setTimeout(() => {
          deferredRender = null;
          void ctx.renderCurrentFrame({ interactive: true });
        }, DEFERRED_INTERACTIVE_RENDER_DELAY_MS);
      });
    },
    updateTransform(next) {
      const preview = ctx.state.canvasTransformPreview;
      if (!preview || preview.layerId !== options?.layerId) {
        return;
      }
      preview.box = projectCanvasTransformPreviewBox({
        box: preview.initialBox,
        next,
        original: preview.original,
      });
    },
  };
}
