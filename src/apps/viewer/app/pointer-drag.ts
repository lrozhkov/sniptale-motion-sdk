import type { ViewerAppContext } from "./context.js";

function bindPointerDrag(
  ctx: ViewerAppContext,
  pointerId,
  target,
  onMove,
  onEnd = null,
) {
  ctx.state.dragMoved = false;
  const editorFingerprintAtStart = ctx.getEditorContentFingerprint?.() ?? null;
  const usePointerEvents = pointerId !== undefined && pointerId !== null;
  if (usePointerEvents) {
    target.setPointerCapture?.(pointerId);
  }
  const onPointerMove = (event) => onMove(event);
  const onMouseMove = (event) => onMove(event);
  const finish = (event) => {
    if (ctx.state.dragMoved) {
      ctx.state.dragSuppressClickKey = getDragClickTargetKey(target);
      ctx.state.dragSuppressClickTarget = target;
      ctx.state.dragSuppressClickUntil = performance.now() + 250;
    }
    if (
      usePointerEvents &&
      (!target.hasPointerCapture || target.hasPointerCapture(pointerId))
    ) {
      target.releasePointerCapture?.(pointerId);
    }
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    window.removeEventListener("mouseup", finish);
    try {
      onEnd?.(event);
    } finally {
      if (
        ctx.state.dragMoved &&
        editorFingerprintAtStart !== null &&
        editorFingerprintAtStart !== ctx.getEditorContentFingerprint?.()
      ) {
        ctx.markEditorChanged?.("pointer-drag-end", { immediate: true });
      }
    }
  };
  if (usePointerEvents) {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", finish, { once: true });
    window.addEventListener("pointercancel", finish, { once: true });
  } else {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", finish, { once: true });
  }
}

function shouldSuppressDragClick(ctx: ViewerAppContext, event): boolean {
  if (performance.now() >= ctx.state.dragSuppressClickUntil) {
    clearDragClickSuppression(ctx);
    return false;
  }
  const targetMatches =
    ctx.state.dragSuppressClickTarget === event?.currentTarget ||
    ctx.state.dragSuppressClickTarget === event?.target;
  const keyMatches =
    Boolean(ctx.state.dragSuppressClickKey) &&
    [event?.currentTarget, event?.target].some(
      (target) =>
        getDragClickTargetKey(target) === ctx.state.dragSuppressClickKey,
    );
  if (!targetMatches && !keyMatches) {
    return false;
  }
  clearDragClickSuppression(ctx);
  return true;
}

function clearDragClickSuppression(ctx: ViewerAppContext): void {
  ctx.state.dragSuppressClickKey = null;
  ctx.state.dragSuppressClickTarget = null;
  ctx.state.dragSuppressClickUntil = 0;
}

function getDragClickTargetKey(target): string | null {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return null;
  }
  const dataset = (target as HTMLElement).dataset ?? {};
  const roleClass = [
    "keyframe-point",
    "clip-block",
    "phase-block",
    "scene-block",
    "timeline-edge",
    "timeline-lane-body",
    "timeline-lane-label",
    "graph-keyframe-point",
    "graph-bezier-handle",
    "graph-selection-range-handle",
  ].find((className) => target.classList.contains(className));
  const identity = [
    target.id,
    dataset.trackId,
    dataset.keyframeId,
    dataset.layerId,
    dataset.phaseId,
    dataset.sceneId,
    dataset.handle,
    dataset.rangeEdge,
    target.classList.contains("start") ? "start" : "",
    target.classList.contains("end") ? "end" : "",
  ]
    .filter(Boolean)
    .join(":");
  return roleClass || identity
    ? `${target.tagName}:${roleClass ?? "element"}:${identity}`
    : null;
}

export function installAppPointerDragOwner(ctx: ViewerAppContext): void {
  ctx.bindPointerDrag = bindPointerDrag.bind(undefined, ctx);
  ctx.shouldSuppressDragClick = shouldSuppressDragClick.bind(undefined, ctx);
}
