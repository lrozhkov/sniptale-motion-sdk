import type { EffectV1ObjectLayout } from "../../../../sdk/effect-v1/types.js";
import { resolveEffectV1ObjectRenderBounds } from "../../../../sdk/effect-v1/object-handles.js";

export function applyEffectV1ObjectLayout(
  layout: EffectV1ObjectLayout | undefined,
  context: any,
  canvasContext: any,
): any {
  if (!layout) return context;
  const scaled = layout.resize === "scale";
  const bounds = scaled
    ? resolveEffectV1ObjectRenderBounds(layout, context.controls ?? {})
    : { x: 0, y: 0, width: context.width, height: context.height };
  const scale = scaled
    ? Math.min(context.width / bounds.width, context.height / bounds.height)
    : 1;
  canvasContext.translate(
    (context.width - bounds.width * scale) / 2 - bounds.x * scale,
    (context.height - bounds.height * scale) / 2 - bounds.y * scale,
  );
  canvasContext.scale(scale, scale);
  canvasContext.beginPath();
  canvasContext.rect(bounds.x, bounds.y, bounds.width, bounds.height);
  canvasContext.clip();
  return scaled
    ? { ...context, width: layout.width, height: layout.height }
    : context;
}
