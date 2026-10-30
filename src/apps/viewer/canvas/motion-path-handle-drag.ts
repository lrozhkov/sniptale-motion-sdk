import type { ViewerAppContext } from "../app/context.js";
import { activateCanvasDrag, createCanvasDragPreview } from "./drag-preview.js";

function beginMotionPathTangentDrag(
  ctx: ViewerAppContext,
  event,
  layerId: string,
  xKeyframeId: string,
  yKeyframeId: string,
  side: "in" | "out",
) {
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const layer = effectiveTemplate?.layers.find((item) => item.id === layerId);
  const model = ctx.getCanvasMotionPathModel(template, layerId);
  const point = model.ok
    ? model.points.find(
        (candidate) =>
          candidate.xKeyframeId === xKeyframeId &&
          candidate.yKeyframeId === yKeyframeId,
      )
    : null;
  if (
    !template ||
    !effectiveTemplate ||
    !layer ||
    !point ||
    point.kind === "linear" ||
    layer.locked ||
    !point.enabled ||
    !ctx.isLayerActiveAtTime(effectiveTemplate, layer.id, point.time)
  ) {
    return;
  }
  ctx.selectCanvasMotionPathPoint(layerId, xKeyframeId, yKeyframeId, null, {
    sync: false,
  });
  const canvasRect = ctx.refs.canvas.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const original = { ...point[`${side}Tangent`] };
  const preview = createCanvasDragPreview(ctx);
  const handle = event.currentTarget as SVGCircleElement;
  const line = handle.previousElementSibling as SVGLineElement | null;
  const handleStart = {
    x: Number(handle.getAttribute("cx")) || 0,
    y: Number(handle.getAttribute("cy")) || 0,
  };
  let latest = original;
  const onMove = (moveEvent) => {
    const pageDx = moveEvent.clientX - startX;
    const pageDy = moveEvent.clientY - startY;
    if (
      !activateCanvasDrag(ctx, Math.abs(pageDx) + Math.abs(pageDy), () =>
        ctx.beginEditorCommand({
          payload: {
            layerId,
            side,
            xKeyframeId,
            yKeyframeId,
          },
          type: "updateMotionPathTangent",
        }),
      )
    ) {
      return;
    }
    latest = {
      x:
        original.x +
        (pageDx / Math.max(1, canvasRect.width)) * ctx.refs.canvas.width,
      y:
        original.y +
        (pageDy / Math.max(1, canvasRect.height)) * ctx.refs.canvas.height,
    };
    handle.setAttribute("cx", (handleStart.x + pageDx).toFixed(2));
    handle.setAttribute("cy", (handleStart.y + pageDy).toFixed(2));
    line?.setAttribute("x2", (handleStart.x + pageDx).toFixed(2));
    line?.setAttribute("y2", (handleStart.y + pageDy).toFixed(2));
    preview.scheduleUpdate(() => {
      ctx.updateCanvasMotionPathTangent(
        layerId,
        xKeyframeId,
        yKeyframeId,
        side,
        latest,
        {
          inspector: false,
          render: false,
          selection: false,
          timeline: false,
        },
      );
    });
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () => {
    if (ctx.state.dragMoved) {
      preview.finalize(() => {
        ctx.updateCanvasMotionPathTangent(
          layerId,
          xKeyframeId,
          yKeyframeId,
          side,
          latest,
          { render: false },
        );
      });
      void ctx.settlePreviewAfterInteraction();
    } else {
      preview.finalize();
      ctx.syncTimelineSelection(template);
    }
  });
}

function handleMotionPathTangentKeydown(
  ctx: ViewerAppContext,
  event,
  layerId: string,
  xKeyframeId: string,
  yKeyframeId: string,
  side: "in" | "out",
) {
  const delta = getKeyboardTangentDelta(event);
  if (!delta) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  const layer = ctx
    .getEffectiveTemplate(template)
    ?.layers.find((item) => item.id === layerId);
  const model = ctx.getCanvasMotionPathModel(template, layerId);
  const point = model.ok
    ? model.points.find(
        (candidate) =>
          candidate.xKeyframeId === xKeyframeId &&
          candidate.yKeyframeId === yKeyframeId,
      )
    : null;
  if (!layer || !point || !ctx.canEditCanvasMotionPathPoint(layer, point)) {
    if (layer && point) {
      ctx.reportCanvasMotionPathEditFailure(layer, point);
    }
    return;
  }
  ctx.selectCanvasMotionPathPoint(layerId, xKeyframeId, yKeyframeId);
  ctx.beginEditorCommand(
    {
      payload: { layerId, side, xKeyframeId, yKeyframeId },
      type: "updateMotionPathTangent",
    },
    {
      coalesceKey: `keyboard-motion-tangent:${layerId}:${xKeyframeId}:${yKeyframeId}:${side}`,
    },
  );
  const tangent = point[`${side}Tangent`];
  ctx.updateCanvasMotionPathTangent(
    layerId,
    xKeyframeId,
    yKeyframeId,
    side,
    {
      x: tangent.x + delta.x,
      y: tangent.y + delta.y,
    },
    { render: false, selection: false },
  );
  void ctx.renderCurrentFrame().finally(() => {
    ctx.updateCanvasSelectionBox();
    const handle = ctx.refs.motionPathOverlay.querySelector(
      `.motion-path-tangent-handle[data-layer-id="${ctx.cssEscape(layerId)}"][data-x-keyframe-id="${ctx.cssEscape(xKeyframeId)}"][data-y-keyframe-id="${ctx.cssEscape(yKeyframeId)}"][data-side="${side}"]`,
    );
    if (handle instanceof SVGElement) handle.focus();
  });
}

function getKeyboardTangentDelta(event) {
  const step = event.shiftKey ? 10 : 1;
  if (event.key === "ArrowLeft") return { x: -step, y: 0 };
  if (event.key === "ArrowRight") return { x: step, y: 0 };
  if (event.key === "ArrowUp") return { x: 0, y: -step };
  if (event.key === "ArrowDown") return { x: 0, y: step };
  return null;
}

export function installCanvasMotionPathHandleDragOwner(
  ctx: ViewerAppContext,
): void {
  ctx.beginMotionPathTangentDrag = beginMotionPathTangentDrag.bind(
    undefined,
    ctx,
  );
  ctx.handleMotionPathTangentKeydown = handleMotionPathTangentKeydown.bind(
    undefined,
    ctx,
  );
}
