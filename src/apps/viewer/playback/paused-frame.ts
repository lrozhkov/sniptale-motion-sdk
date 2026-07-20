import type { ViewerAppContext } from "../app/context.js";

export async function renderPausedFrame(ctx: ViewerAppContext): Promise<void> {
  const pausedTemplateId = ctx.state.currentTemplate?.id;
  await ctx.renderCurrentFrame({ interactive: true });
  await new Promise((resolve) => window.setTimeout(resolve, 120));
  if (
    !ctx.state.playing &&
    pausedTemplateId &&
    ctx.state.currentTemplate?.id === pausedTemplateId
  ) {
    await ctx.refinePreviewAtFullQuality();
  }
}
