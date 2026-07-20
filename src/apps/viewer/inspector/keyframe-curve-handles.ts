import type { ViewerAppContext } from "../app/context.js";

function createCurveHandleNumberField(
  ctx: ViewerAppContext,
  track,
  keyframe,
  label,
  property,
  value,
) {
  return ctx.createCurveField(
    label,
    "number",
    ctx.roundInspectorNumber(value),
    (nextValue) =>
      ctx.updateSelectedKeyframe(
        { handles: { [property]: ctx.deps.clamp(Number(nextValue), 0, 1) } },
        track.id,
        keyframe.id,
      ),
    {
      keyframeId: keyframe.id,
      keyframeProperty: `handle-${property}`,
      max: 1,
      min: 0,
      trackId: track.id,
    },
  );
}

export function installInspectorKeyframeCurveHandlesOwner(
  ctx: ViewerAppContext,
): void {
  ctx.createCurveHandleNumberField = (...args: any[]) =>
    (createCurveHandleNumberField as any)(ctx, ...args);
}
