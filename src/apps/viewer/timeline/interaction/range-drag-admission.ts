import type { ViewerAppContext } from "../../app/context.js";
import type { TimelineRangeEditMode } from "../model/move-plan-model.js";
export function admitTimelineRangeDrag(
  ctx: ViewerAppContext,
  event: PointerEvent,
  mode: TimelineRangeEditMode,
): HTMLElement | undefined {
  if (event.button !== 0) {
    return;
  }
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  ctx.state.pointerDragCleanup?.();
  if (event.altKey || event.shiftKey) {
    ctx.beginTimelineMarqueeSelection(event, { allowBlockStart: true });
    return;
  }
  if (mode === "move" && (event.shiftKey || event.metaKey || event.ctrlKey)) {
    return;
  }
  return target;
}
