import type { ViewerAppContext } from "../app/context.js";
import { resolvePreviewMediaSlots } from "../preview-media/model.js";

export function templateUsesInputFrames(template): boolean {
  return resolvePreviewMediaSlots(template).length > 0;
}

async function createRenderInputFrames(
  ctx: ViewerAppContext,
  template,
  width,
  height,
  progress,
) {
  if (!templateUsesInputFrames(template)) {
    return { frames: {}, transfer: [] };
  }
  const slots = resolvePreviewMediaSlots(template);
  const customFrames = Object.fromEntries(
    await Promise.all(
      slots.map(async (slot) => [
        slot,
        await ctx.createPreviewMediaFrame(slot, width, height, progress),
      ]),
    ),
  );
  const needsFallback = slots.some((slot) => !customFrames[slot]);
  const fallback = needsFallback
    ? await ctx.deps.createInputFrames(width, height, progress)
    : null;
  const frames: Record<string, ImageBitmap> = {};
  for (const slot of slots) {
    const frame =
      customFrames[slot] ??
      (slot === "to" ? fallback?.next : fallback?.previous);
    if (frame) frames[slot] = frame;
  }
  if (fallback) {
    if (!Object.values(frames).includes(fallback.previous)) {
      fallback.previous.close();
    }
    if (!Object.values(frames).includes(fallback.next)) fallback.next.close();
  }
  return {
    frames,
    transfer: Object.values(frames),
  };
}

export function installRenderingInputFramesOwner(ctx: ViewerAppContext): void {
  ctx.createRenderInputFrames = createRenderInputFrames.bind(undefined, ctx);
}
