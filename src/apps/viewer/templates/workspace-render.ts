import { syncStudioActions } from "../studio/controller.js";
import type { ViewerAppContext } from "../app/context.js";

export function renderTemplateWorkspace(
  ctx: ViewerAppContext,
  template: any,
): void {
  syncStudioActions(ctx);
  ctx.renderControls(template);
  ctx.renderTimelineEditor(template);
}
