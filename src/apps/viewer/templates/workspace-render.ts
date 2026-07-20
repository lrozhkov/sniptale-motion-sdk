import type { ViewerAppContext } from "../app/context.js";

export function renderTemplateWorkspace(
  ctx: ViewerAppContext,
  template: any,
): void {
  ctx.renderControls(template);
  ctx.renderTimelineEditor(template);
}
