import type { CanvasTransformState } from "./transform-state.js";
import type { RenderOptions } from "../rendering/state.js";
import type { CanvasTransformValues } from "./transform-state.js";
import type { CanvasBox } from "./primitive-geometry.js";
import type { EffectLayer } from "../../../sdk/types.js";
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
  box: CanvasBox;
  layer: EffectLayer;
  layerId: string;
};

export function projectCanvasTransformPreviewBox({
  box,
  next,
  original,
}: {
  box: CanvasBox;
  next: Partial<CanvasTransformValues>;
  original: CanvasTransformValues;
}): CanvasBox {
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

type CanvasDragContext = {
  state: CanvasTransformState & {
    currentTemplate?: { id: string } | null;
    dragMoved?: boolean;
    previewCacheEnabled?: boolean;
  };
  refs: { canvasSelectionBox: Pick<HTMLElement, "dataset"> };
  renderCurrentFrame(options?: RenderOptions): Promise<void>;
  getResolvedLayerAnchor?: (layer: EffectLayer) => { x: number; y: number };
  getResolvedLayerProperty?: (
    layer: EffectLayer,
    property: keyof CanvasTransformValues,
  ) => number;
};

export function createCanvasDragPreview(
  ctx: CanvasDragContext,
  options: CanvasTransformPreviewOptions | null = null,
) {
  let frame = 0;
  let deferredRender: ReturnType<typeof setTimeout> | null = null;
  let pendingUpdate: (() => void) | null = null;
  ctx.state.canvasTransformDragActive = true;
  if (options) {
    if (!ctx.getResolvedLayerAnchor || !ctx.getResolvedLayerProperty)
      throw new Error("Canvas preview geometry is unavailable.");
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
  const ownedPreview = ctx.state.canvasTransformPreview;
  const ownedTemplate = ctx.state.currentTemplate;
  let finalized = false;
  const isCurrentPreview = () =>
    !finalized &&
    ctx.state.canvasTransformPreview === ownedPreview &&
    ctx.state.currentTemplate === ownedTemplate;
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
        if (isCurrentPreview()) finalUpdate?.();
      } finally {
        if (isCurrentPreview()) {
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
        finalized = true;
      }
    },
    scheduleUpdate(update: () => void) {
      if (!isCurrentPreview()) return;
      pendingUpdate = update;
      if (frame) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        const applyUpdate = pendingUpdate;
        pendingUpdate = null;
        if (!isCurrentPreview()) return;
        applyUpdate?.();
        if (!isCurrentPreview()) return;
        if (ctx.state.previewCacheEnabled === false) {
          void ctx.renderCurrentFrame({ interactive: true });
          return;
        }
        if (deferredRender) {
          clearTimeout(deferredRender);
        }
        deferredRender = globalThis.setTimeout(() => {
          deferredRender = null;
          if (isCurrentPreview())
            void ctx.renderCurrentFrame({ interactive: true });
        }, DEFERRED_INTERACTIVE_RENDER_DELAY_MS);
      });
    },
    updateTransform(next: Partial<CanvasTransformValues>) {
      const preview = ctx.state.canvasTransformPreview;
      if (
        !isCurrentPreview() ||
        !options ||
        !preview ||
        preview.layerId === undefined ||
        preview.layerId !== options.layerId
      ) {
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
