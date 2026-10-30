import type { ViewerAppContext } from "../app/context.js";
import {
  createKeyframeScalePlan,
  createKeyframeTimeSnapshot,
} from "../timeline/model/keyframe-transform.js";
import {
  activateTimelineDrag,
  createTimelineDragPreview,
} from "../timeline/interaction/drag-preview.js";
import { graphXToTime } from "./model.js";
import {
  applyGraphTimePlan,
  commitInteractiveGraphTimeline,
  createGraphPointerMapper,
} from "./interaction-shared.js";

function beginGraphSelectionScale(ctx: ViewerAppContext, event, model, edge) {
  if (event.button !== 0 || !model.selectionBounds?.duration) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const snapshot = createKeyframeTimeSnapshot(
    timeline,
    ctx.getSelectedKeyframeRefs(),
    ctx.getEffectiveDuration(template),
    1 / Math.max(1, Number(ctx.refs.fpsInput.value) || 30),
  );
  if (!template || !snapshot) {
    return;
  }
  const startX = event.clientX;
  const svg = event.currentTarget.ownerSVGElement;
  const mapPointer = createGraphPointerMapper(svg);
  const preview = createTimelineDragPreview(ctx, template);
  const onMove = (moveEvent) => {
    const pointer = mapPointer(moveEvent);
    const requested = ctx.snapTime(graphXToTime(pointer.x, model.viewport));
    const factor =
      edge === "start"
        ? (snapshot.bounds.end - requested) / snapshot.bounds.duration
        : (requested - snapshot.bounds.start) / snapshot.bounds.duration;
    const plan = createKeyframeScalePlan(
      snapshot,
      factor,
      edge === "start" ? "end" : "start",
      ctx.snapTime,
    );
    if (!plan.ok) {
      return;
    }
    if (
      !activateTimelineDrag(ctx, Math.abs(moveEvent.clientX - startX), () =>
        ctx.beginEditorCommand({
          payload: { edge, keyframes: snapshot.refs },
          type: "scaleKeyframes",
        }),
      )
    ) {
      return;
    }
    preview.scheduleUpdate(() => {
      applyGraphTimePlan(timeline, snapshot, plan);
      commitInteractiveGraphTimeline(ctx, template, timeline);
    });
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () =>
    preview.finalize(),
  );
}

export function installGraphEditorRangeScaleOwner(ctx: ViewerAppContext): void {
  ctx.beginGraphSelectionScale = beginGraphSelectionScale.bind(undefined, ctx);
}
