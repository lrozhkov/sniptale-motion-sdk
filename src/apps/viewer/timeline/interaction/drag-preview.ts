import type { ViewerAppContext } from "../../app/context.js";
import { syncTimelineInteractionGeometry } from "./preview-geometry.js";

type DragUpdate = () => void;

export function activateTimelineDrag(
  ctx: ViewerAppContext,
  distance: number,
  startCommand: () => void,
  threshold = 2,
): boolean {
  if (ctx.state.dragMoved) {
    return true;
  }
  if (distance <= threshold) {
    return false;
  }
  ctx.state.dragMoved = true;
  startCommand();
  return true;
}

export function createTimelineDragPreview(ctx: ViewerAppContext, template) {
  let frame = 0;
  let finalized = false;
  let pendingUpdate: DragUpdate | null = null;
  let pendingAfterRender: DragUpdate | null = null;
  if (ctx.state.playing) {
    ctx.pausePlayback({
      preservePreparation: true,
      renderCurrentFrame: false,
    });
  }
  ctx.state.timelineDragActive = true;

  const flush = (full: boolean) => {
    const update = pendingUpdate;
    const afterRender = pendingAfterRender;
    pendingUpdate = null;
    pendingAfterRender = null;
    update?.();
    if (full) {
      ctx.renderTimelineEditor(template);
    } else {
      renderTimelineInteractionPreview(ctx, template);
    }
    afterRender?.();
    if (full) {
      void ctx.settlePreviewAfterInteraction();
    } else {
      void ctx.renderCurrentFrame({ interactive: true });
    }
  };

  return {
    finalize() {
      if (finalized) {
        return;
      }
      finalized = true;
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      try {
        if (ctx.state.dragMoved) {
          flush(true);
        } else {
          pendingUpdate = null;
          pendingAfterRender = null;
        }
      } finally {
        ctx.state.timelineDragActive = false;
      }
    },
    scheduleUpdate(update: DragUpdate, afterRender: DragUpdate | null = null) {
      pendingUpdate = update;
      pendingAfterRender = afterRender;
      if (frame) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        flush(false);
      });
    },
  };
}

function renderTimelineInteractionPreview(ctx: ViewerAppContext, template) {
  const timeline = ctx.getEffectiveTimeline(template);
  syncTimelineInteractionGeometry(ctx, template, timeline);
  ctx.renderCurveEditor(timeline);
  ctx.renderSelectionCrumb(template);
  ctx.updateTimelinePlayhead();
  ctx.updateCanvasSelectionBox();
}
