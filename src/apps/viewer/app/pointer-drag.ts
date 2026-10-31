import { bindViewerAction } from "./bind-action.js";
import type { PointerDragActions } from "./pointer-contract.js";
import type { PointerDragContext } from "./pointer-context.js";
import {
  getDragClickTargetKey,
  clearDragClickSuppression,
  shouldSuppressDragClick,
} from "./pointer-click.js";

function bindPointerDrag(
  ctx: PointerDragContext,
  pointerId: number | null | undefined,
  target: unknown,
  onMove: (event: MouseEvent) => void,
  onEnd: ((event: MouseEvent) => void) | null = null,
): void {
  if (!(target instanceof Element)) return;
  const activePointerId = pointerId ?? null;
  if (activePointerId !== null && !Number.isSafeInteger(activePointerId))
    return;
  ctx.state.pointerDragCleanup?.();
  clearDragClickSuppression(ctx);
  ctx.state.dragMoved = false;
  const source = ctx.state.currentTemplate;
  const initialFingerprint = ctx.getEditorContentFingerprint?.() ?? null;
  let finished = false;

  const onPointerMove = (event: PointerEvent) => {
    if (!finished && event.pointerId === activePointerId) onMove(event);
  };
  const onMouseMove = (event: MouseEvent) => {
    if (!finished) onMove(event);
  };
  const onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId === activePointerId) finish(event);
  };
  const onMouseEnd = (event: MouseEvent) => finish(event);
  const cancel = () => finish(new MouseEvent("pointercancel"));
  const finish = (event: MouseEvent) => {
    if (finished) return;
    finished = true;
    const moved = ctx.state.dragMoved;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerEnd);
    window.removeEventListener("pointercancel", onPointerEnd);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseEnd);
    window.removeEventListener("blur", cancel);
    if (ctx.state.pointerDragCleanup === cancel)
      ctx.state.pointerDragCleanup = null;
    if (activePointerId !== null) {
      try {
        if (target.hasPointerCapture(activePointerId))
          target.releasePointerCapture(activePointerId);
      } catch {
        // The target can detach before pointer capture is released.
      }
    }
    if (moved && ctx.state.currentTemplate === source) {
      ctx.state.dragSuppressClickKey = getDragClickTargetKey(target);
      ctx.state.dragSuppressClickTarget = target;
      ctx.state.dragSuppressClickUntil = performance.now() + 250;
    }
    try {
      onEnd?.(event);
    } finally {
      if (
        moved &&
        ctx.state.currentTemplate === source &&
        initialFingerprint !== null &&
        initialFingerprint !== ctx.getEditorContentFingerprint?.()
      ) {
        ctx.markEditorChanged?.("pointer-drag-end", { immediate: true });
      }
    }
  };
  ctx.state.pointerDragCleanup = cancel;
  window.addEventListener("blur", cancel);
  if (activePointerId !== null) {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    try {
      target.setPointerCapture(activePointerId);
    } catch {
      // Window listeners also handle a drag when capture is unavailable.
    }
  } else {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseEnd);
  }
}

export function createPointerDragActions(
  getContext: () => PointerDragContext,
): PointerDragActions {
  return {
    bindPointerDrag: bindViewerAction(bindPointerDrag, getContext),
    shouldSuppressDragClick: bindViewerAction(
      shouldSuppressDragClick,
      getContext,
    ),
  };
}
