import type { EditorTimelineSource } from "../../editor/timeline-source.js";
import type { ViewerAppContext } from "../../app/context.js";
import { syncTimelineInteractionGeometry } from "./preview-geometry.js";

type DragUpdate = () => void;

export function createTimelineDragPreview(
  ctx: ViewerAppContext,
  template: EditorTimelineSource,
  options: { renderPreview?: () => void } = {},
) {
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
  const session = {};
  ctx.state.timelineDragSession = session;
  ctx.state.timelineDragActive = true;
  let editorRevision = ctx.state.editorOverrides.get(template.id);
  let timelineRevision = ctx.state.timelineOverrides.get(template.id);
  const ownsSession = () =>
    ctx.state.timelineDragSession === session &&
    ctx.state.currentTemplate === template;
  const isCurrent = () =>
    ownsSession() &&
    ctx.state.editorOverrides.get(template.id) === editorRevision &&
    ctx.state.timelineOverrides.get(template.id) === timelineRevision;
  const release = () => {
    if (ctx.state.timelineDragSession === session) {
      ctx.state.timelineDragSession = null;
      ctx.state.timelineDragActive = false;
    }
  };
  const discard = () => {
    finalized = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    pendingUpdate = null;
    pendingAfterRender = null;
    release();
  };

  const canUpdate = (): boolean => {
    if (finalized) return false;
    if (!isCurrent()) {
      discard();
      return false;
    }
    return true;
  };

  const flush = (full: boolean) => {
    if (!isCurrent()) {
      discard();
      return;
    }
    const update = pendingUpdate;
    const afterRender = pendingAfterRender;
    pendingUpdate = null;
    pendingAfterRender = null;
    update?.();
    if (!ownsSession()) {
      discard();
      return;
    }
    editorRevision = ctx.state.editorOverrides.get(template.id);
    timelineRevision = ctx.state.timelineOverrides.get(template.id);
    if (full) {
      ctx.renderTimelineEditor(template);
    } else {
      if (options.renderPreview) options.renderPreview();
      else renderTimelineInteractionPreview(ctx, template);
    }
    if (!isCurrent()) {
      discard();
      return;
    }
    afterRender?.();
    if (full) {
      void ctx.settlePreviewAfterInteraction();
    } else {
      void ctx.renderCurrentFrame({ interactive: true });
    }
  };

  return {
    activate(
      distance: number,
      startCommand: () => void,
      threshold = 2,
    ): boolean {
      if (!canUpdate()) return false;
      if (ctx.state.dragMoved) return true;
      if (distance <= threshold) return false;
      ctx.state.dragMoved = true;
      startCommand();
      return true;
    },
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
        if (ctx.state.dragMoved && isCurrent()) {
          flush(true);
        } else {
          pendingUpdate = null;
          pendingAfterRender = null;
        }
      } finally {
        release();
      }
    },
    scheduleUpdate(update: DragUpdate, afterRender: DragUpdate | null = null) {
      if (!canUpdate()) return;
      pendingUpdate = update;
      pendingAfterRender = afterRender;
      if (frame) {
        return;
      }
      frame = requestAnimationFrame(() => {
        if (finalized) return;
        frame = 0;
        flush(false);
      });
    },
  };
}

function renderTimelineInteractionPreview(
  ctx: ViewerAppContext,
  template: EditorTimelineSource,
): void {
  const timeline = ctx.getEffectiveTimeline(template);
  syncTimelineInteractionGeometry(ctx, template, timeline);
  ctx.renderCurveEditor(timeline);
  ctx.renderSelectionCrumb(template);
  ctx.updateTimelinePlayhead();
  ctx.updateCanvasSelectionBox();
}
