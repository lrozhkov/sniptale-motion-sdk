import { getLogicalCanvasScale } from "../logical-canvas.js";
import { isRecord, n, type RenderState, v, withItem } from "./model.js";

export function createSvgPartTransform(
  value: unknown,
  state: RenderState,
): any {
  if (!isRecord(value)) return undefined;
  if (value.kind === "preset") {
    const resolved = Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "kind")
        .map(([key, expression]) => [key, v(expression, state)]),
    );
    return state.runtime.svgPartTransform(resolved);
  }
  if (value.kind !== "custom") return undefined;
  return (part: any, index: number, parsed: any) =>
    withItem(
      state,
      {
        ...part,
        count: Math.max(1, parsed?.parts?.length ?? 1),
        index,
      },
      () => resolveCustomSvgPartTransform(value, state),
    );
}

function resolveCustomSvgPartTransform(value: any, state: RenderState) {
  const result: Record<string, unknown> = {};
  for (const key of [
    "alpha",
    "originX",
    "originY",
    "rotate",
    "scale",
    "x",
    "y",
  ]) {
    if (value[key] !== undefined) result[key] = n(value[key], state);
  }
  if (value.blur !== undefined) {
    const blur =
      Math.max(0, n(value.blur, state)) *
      getLogicalCanvasScale(state.context).uniform;
    result.filter = blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : "none";
  }
  return result;
}
