import type { PointerDragContext } from "./pointer-context.js";

export function shouldSuppressDragClick(
  ctx: PointerDragContext,
  event: unknown,
): boolean {
  if (performance.now() >= ctx.state.dragSuppressClickUntil) {
    clearDragClickSuppression(ctx);
    return false;
  }
  if (!event || typeof event !== "object" || Array.isArray(event)) return false;
  const currentTarget =
    "currentTarget" in event ? event.currentTarget : undefined;
  const target = "target" in event ? event.target : undefined;
  const targetMatches =
    ctx.state.dragSuppressClickTarget === currentTarget ||
    ctx.state.dragSuppressClickTarget === target;
  const keyMatches =
    Boolean(ctx.state.dragSuppressClickKey) &&
    [currentTarget, target].some(
      (item) => getDragClickTargetKey(item) === ctx.state.dragSuppressClickKey,
    );
  if (!targetMatches && !keyMatches) return false;
  clearDragClickSuppression(ctx);
  return true;
}

export function clearDragClickSuppression(ctx: PointerDragContext): void {
  ctx.state.dragSuppressClickKey = null;
  ctx.state.dragSuppressClickTarget = null;
  ctx.state.dragSuppressClickUntil = 0;
}

export function getDragClickTargetKey(target: unknown): string | null {
  if (typeof Element === "undefined" || !(target instanceof Element))
    return null;
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
  ].find((name) => target.classList.contains(name));
  const identity = [
    target.id,
    ...[
      "track-id",
      "keyframe-id",
      "layer-id",
      "phase-id",
      "scene-id",
      "handle",
      "range-edge",
    ].map((name) => target.getAttribute(`data-${name}`) ?? ""),
    target.classList.contains("start") ? "start" : "",
    target.classList.contains("end") ? "end" : "",
  ];
  return roleClass || identity.some(Boolean)
    ? JSON.stringify([target.tagName, roleClass ?? "element", ...identity])
    : null;
}
