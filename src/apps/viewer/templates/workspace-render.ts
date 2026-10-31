import type { EditorTemplateSource } from "./model.js";
import { syncStudioActions } from "../studio/controller.js";
import type { ViewerAppContext } from "../app/context.js";

export function renderTemplateWorkspace(
  ctx: ViewerAppContext,
  template: EditorTemplateSource,
): void {
  syncStudioActions(ctx);
  ctx.renderControls(template);
  ctx.renderTimelineEditor(template);
}
