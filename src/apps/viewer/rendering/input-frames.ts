import { bindViewerAction } from "../app/bind-action.js";
import type { ViewerAppContext } from "../app/context.js";
import type {
  RenderInputFrames,
  ViewerRenderOutputActions,
} from "./output-contract.js";
import { resolvePreviewMediaSlots } from "../preview-media/model.js";

export function templateUsesInputFrames(template: unknown): boolean {
  return resolvePreviewMediaSlots(template).length > 0;
}

async function createRenderInputFrames(
  ctx: ViewerAppContext,
  template: unknown,
  width: number,
  height: number,
  progress: number,
): Promise<RenderInputFrames> {
  const slots = resolvePreviewMediaSlots(template);
  if (slots.length === 0) return { frames: {}, transfer: [] };
  const results = await Promise.allSettled(
    slots.map(async (slot): Promise<ImageBitmap | null> =>
      ctx.createPreviewMediaFrame(slot, width, height, progress),
    ),
  );
  const owned = new Set<ImageBitmap>();
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) owned.add(result.value);
  }
  try {
    for (const result of results) {
      if (result.status === "rejected") {
        const reason: unknown = result.reason;
        throw reason;
      }
    }
    const custom = results.map((result) =>
      result.status === "fulfilled" ? result.value : null,
    );
    const fallback = custom.some((frame) => !frame)
      ? await ctx.deps.createInputFrames(width, height, progress)
      : null;
    if (fallback) {
      owned.add(fallback.previous);
      owned.add(fallback.next);
    }
    const frames: RenderInputFrames["frames"] = {};
    for (const [index, slot] of slots.entries()) {
      const frame =
        custom[index] ?? (slot === "to" ? fallback?.next : fallback?.previous);
      if (frame) frames[slot] = frame;
    }
    const transfer = [...new Set(Object.values(frames))];
    const transferred = new Set(transfer);
    for (const frame of owned) {
      if (!transferred.has(frame)) {
        owned.delete(frame);
        frame.close();
      }
    }
    return { frames, transfer };
  } catch (error) {
    for (const frame of owned) frame.close();
    throw error;
  }
}

export function createRenderInputActions(
  getContext: () => ViewerAppContext,
): Pick<ViewerRenderOutputActions, "createRenderInputFrames"> {
  return {
    createRenderInputFrames: bindViewerAction(
      createRenderInputFrames,
      getContext,
    ),
  };
}
