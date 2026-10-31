import { bindViewerAction } from "../app/bind-action.js";
import type { GraphRuntimeActions } from "./contract.js";
import type { GraphEditorModel } from "./model-types.js";
import {
  readGraphPointerTarget,
  createGraphPointerMapper,
} from "./pointer-coordinates.js";
import { keyframeRefKey } from "../timeline/model/keyframe-reference.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  createKeyframeMovePlan,
  createKeyframeTimeSnapshot,
} from "../timeline/model/keyframe-transform.js";
import { expandMotionPathKeyframeSelection } from "../timeline/model/motion-path-mutations.js";
import { clampTrackNumericValue } from "../layers/property-range.js";
import { createTimelineDragPreview } from "../timeline/interaction/drag-preview.js";
import { graphXToTime, graphYToValue } from "./viewport.js";
import {
  applyGraphTimePlan,
  commitInteractiveGraphTimeline,
} from "./interaction-shared.js";

function beginGraphKeyframeDrag(
  ctx: ViewerAppContext,
  event: PointerEvent,
  model: GraphEditorModel,
  trackId: string,
  keyframeId: string,
) {
  if (ctx.state.currentTemplate !== model.template) return;
  if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey) {
    return;
  }
  const surface = readGraphPointerTarget(event);
  if (!surface) return;
  const { target, svg } = surface;
  event.preventDefault();
  event.stopPropagation();
  ctx.prepareKeyframeSelectionForPointer(event, trackId, keyframeId);
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const refs = expandMotionPathKeyframeSelection(
    timeline,
    ctx.getSelectedKeyframeRefs(),
  );
  ctx.setSelectedKeyframes(refs, { render: false });
  const snapshot = createKeyframeTimeSnapshot(
    timeline,
    refs,
    ctx.getEffectiveDuration(template),
    1 / Math.max(1, Number(ctx.refs.fpsInput.value) || 30),
  );
  const primary = snapshot?.entries.find(
    (entry) => entry.trackId === trackId && entry.keyframeId === keyframeId,
  );
  if (!template || !snapshot || !primary) {
    return;
  }
  const canMoveValue =
    new Set(snapshot.entries.map((entry) => entry.trackId)).size === 1;
  const graphTrack = model.tracks.find((entry) => entry.id === trackId);
  const originalValues = new Map<string, number>();
  if (canMoveValue) {
    for (const entry of snapshot.entries) {
      const track = timeline.tracks.find((item) => item.id === entry.trackId);
      const value = track?.keyframes.find(
        (item) => item.id === entry.keyframeId,
      )?.value;
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      originalValues.set(keyframeRefKey(entry), value);
    }
  }
  const mapPointer = createGraphPointerMapper(svg);
  const startPointer = mapPointer(event);
  if (!startPointer) return;
  const startValue = originalValues.get(keyframeRefKey(primary)) ?? 0;
  const preview = createTimelineDragPreview(ctx, template);
  const onMove = (moveEvent: PointerEvent) => {
    const pointer = mapPointer(moveEvent);
    if (!pointer) return;
    const desiredTime = ctx.snapTime(graphXToTime(pointer.x, model.viewport));
    const movePlan = createKeyframeMovePlan(
      snapshot,
      desiredTime - primary.time,
    );
    if (movePlan.ok === false && movePlan.reason !== "no-change") {
      return;
    }
    const plan =
      movePlan.ok === true
        ? movePlan
        : {
            ok: true as const,
            updates: snapshot.entries,
          };
    if (
      !preview.activate(
        Math.abs(pointer.x - startPointer.x) +
          Math.abs(pointer.y - startPointer.y),
        () =>
          ctx.beginEditorCommand({
            payload: {
              keyframes: snapshot.refs,
              value: canMoveValue,
            },
            type: "transformKeyframes",
          }),
      )
    ) {
      return;
    }
    const valueDelta = canMoveValue
      ? graphYToValue(pointer.y, model.viewport) - startValue
      : 0;
    preview.scheduleUpdate(
      () => {
        applyGraphTimePlan(timeline, plan);
        if (canMoveValue) {
          for (const entry of snapshot.entries) {
            const track = timeline.tracks.find(
              (item) => item.id === entry.trackId,
            );
            const keyframe = track?.keyframes.find(
              (item) => item.id === entry.keyframeId,
            );
            if (keyframe) {
              keyframe.value = clampTrackNumericValue(
                (originalValues.get(keyframeRefKey(entry)) ?? 0) + valueDelta,
                graphTrack?.valueRange ?? null,
              );
            }
          }
        }
        commitInteractiveGraphTimeline(ctx, template, timeline);
      },
      () => {
        const nextTime = plan.updates.find(
          (entry) =>
            entry.trackId === primary.trackId &&
            entry.keyframeId === primary.keyframeId,
        )?.time;
        if (nextTime !== undefined) ctx.showTimelineSnapIndicator(nextTime);
      },
    );
  };
  ctx.bindPointerDrag(event.pointerId, target, onMove, () =>
    preview.finalize(),
  );
}

export function createGraphKeyframeDragActions(
  getContext: () => ViewerAppContext,
): Pick<GraphRuntimeActions, "beginGraphKeyframeDrag"> {
  return {
    beginGraphKeyframeDrag: bindViewerAction(
      beginGraphKeyframeDrag,
      getContext,
    ),
  };
}
