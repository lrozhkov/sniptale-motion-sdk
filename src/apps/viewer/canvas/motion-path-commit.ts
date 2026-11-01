import type { ViewerAppContext } from "../app/context.js";
import type { EditorTemplateSource } from "../templates/model.js";
import type { EditorTimeline } from "../editor/model-types.js";
import type { CanvasMotionPathUpdateOptions } from "./contract.js";
export function commitCanvasMotionPathUpdate(
  ctx: ViewerAppContext,
  template: EditorTemplateSource,
  timeline: EditorTimeline,
  options: CanvasMotionPathUpdateOptions,
): void {
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
  );
  if (options.timeline !== false) {
    if (ctx.renderTimelineModel) {
      ctx.renderTimelineModel(template);
    } else {
      ctx.renderTimelineEditor(template);
    }
  }
  if (options.inspector !== false) {
    ctx.renderInspector();
  }
  if (options.selection !== false) {
    ctx.updateCanvasSelectionBox();
  }
  if (options.render !== false) {
    void ctx.renderCurrentFrame();
  }
}
