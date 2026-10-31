import type { ViewerAppContext } from "../app/context.js";

export function markRendererBinding(
  ctx: ViewerAppContext,
  element: HTMLElement,
  type: string,
  id: unknown,
): void {
  if (isRendererBound(ctx, type, id)) {
    element.dataset.rendererBound = "true";
  } else {
    delete element.dataset.rendererBound;
  }
}

export function isRendererBound(
  ctx: ViewerAppContext,
  type: string,
  id: unknown,
): boolean {
  const value = typeof id === "string" ? id : "";
  if (!value) {
    return false;
  }
  const reads =
    ctx.state.lastBindingReads ?? ctx.deps.createEmptyBindingReads();
  if (type === "phase") {
    return reads.phases.includes(value);
  }
  if (type === "track") {
    return reads.tracks.includes(value);
  }
  if (type === "clip") {
    return reads.layerGateReads.includes(value) || reads.clips.includes(value);
  }
  if (type === "layer") {
    return reads.layerGateReads.includes(value);
  }
  if (type === "control") {
    return reads.controls.includes(value);
  }
  return false;
}
