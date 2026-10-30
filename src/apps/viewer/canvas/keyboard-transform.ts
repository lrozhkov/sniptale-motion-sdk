import type { ViewerAppContext } from "../app/context.js";

const ARROW_DELTAS = {
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
};

function handleCanvasTransformHandleKeydown(ctx: ViewerAppContext, event) {
  const direction = ARROW_DELTAS[event.code];
  if (!direction) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const target = event.currentTarget;
  if (!(target instanceof HTMLButtonElement) || target.disabled) {
    return;
  }
  ctx.setInspectorTab("transform");
  if (target.dataset.rotateHandle) {
    const sign =
      event.code === "ArrowRight" || event.code === "ArrowUp" ? 1 : -1;
    ctx.rotateSelectedCanvasLayer(sign * (event.shiftKey ? 15 : 1));
    return;
  }
  const step = event.shiftKey ? 10 : event.altKey ? 0.5 : 2;
  const delta = { x: direction.x * step, y: direction.y * step };
  if (target.dataset.anchorHandle) {
    ctx.moveSelectedCanvasAnchor(delta);
    return;
  }
  const handle = target.dataset.scaleHandle;
  if (!handle) {
    return;
  }
  if (ctx.refs.canvasSelectionBox.dataset.selectionKind === "multi") {
    const sign = direction.x + direction.y >= 0 ? 1 : -1;
    ctx.scaleCanvasSelectionBy(1 + sign * (event.shiftKey ? 0.1 : 0.01));
    return;
  }
  const affectsDirection =
    (delta.x !== 0 && /e|w/.test(handle)) ||
    (delta.y !== 0 && /n|s/.test(handle));
  if (affectsDirection) {
    ctx.resizeSelectedCanvasLayer(
      handle,
      delta,
      event.shiftKey && handle.length === 2,
    );
  }
}

export function installCanvasKeyboardTransformOwner(
  ctx: ViewerAppContext,
): void {
  ctx.handleCanvasTransformHandleKeydown =
    handleCanvasTransformHandleKeydown.bind(undefined, ctx);
}
