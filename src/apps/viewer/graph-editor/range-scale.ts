import { bindViewerAction } from "../app/bind-action.js";
import type { GraphRuntimeActions } from "./contract.js";
import type { GraphEditorModel } from "./model-types.js";
import {
  readGraphPointerTarget,
  createGraphPointerMapper,
} from "./pointer-coordinates.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  createKeyframeScalePlan,
  createKeyframeTimeSnapshot,
} from "../timeline/model/keyframe-transform.js";
import { createTimelineDragPreview } from "../timeline/interaction/drag-preview.js";
import { graphXToTime } from "./viewport.js";
import {
  applyGraphTimePlan,
  commitInteractiveGraphTimeline,
} from "./interaction-shared.js";

function beginGraphSelectionScale(
  ctx: ViewerAppContext,
  event: PointerEvent,
  model: GraphEditorModel,
  edge: "start" | "end",
) {
  if (ctx.state.currentTemplate !== model.template) return;
  if (event.button !== 0 || !model.selectionBounds?.duration) {
    return;
  }
  const surface = readGraphPointerTarget(event);
  if (!surface) return;
  const { target, svg } = surface;
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
  const mapPointer = createGraphPointerMapper(svg);
  const preview = createTimelineDragPreview(ctx, template);
  const onMove = (moveEvent: PointerEvent) => {
    const pointer = mapPointer(moveEvent);
    if (!pointer) return;
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
      !preview.activate(Math.abs(moveEvent.clientX - startX), () =>
        ctx.beginEditorCommand({
          payload: { edge, keyframes: snapshot.refs },
          type: "scaleKeyframes",
        }),
      )
    ) {
      return;
    }
    preview.scheduleUpdate(() => {
      applyGraphTimePlan(timeline, plan);
      commitInteractiveGraphTimeline(ctx, template, timeline);
    });
  };
  ctx.bindPointerDrag(event.pointerId, target, onMove, () =>
    preview.finalize(),
  );
}

export function createGraphRangeScaleActions(
  getContext: () => ViewerAppContext,
): Pick<GraphRuntimeActions, "beginGraphSelectionScale"> {
  return {
    beginGraphSelectionScale: bindViewerAction(
      beginGraphSelectionScale,
      getContext,
    ),
  };
}
