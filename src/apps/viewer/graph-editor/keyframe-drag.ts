import type { ViewerAppContext } from "../app/context.js";
import {
  createKeyframeMovePlan,
  createKeyframeTimeSnapshot,
  keyframeRefKey,
} from "../timeline/model/keyframe-transform.js";
import { expandMotionPathKeyframeSelection } from "../timeline/model/motion-path-mutations.js";
import { clampTrackNumericValue } from "../layers/property-range.js";
import {
  activateTimelineDrag,
  createTimelineDragPreview,
} from "../timeline/interaction/drag-preview.js";
import { graphXToTime, graphYToValue } from "./model.js";
import {
  applyGraphTimePlan,
  commitInteractiveGraphTimeline,
  createGraphPointerMapper,
} from "./interaction-shared.js";

function beginGraphKeyframeDrag(
  ctx: ViewerAppContext,
  event,
  model,
  trackId,
  keyframeId,
) {
  if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey) {
    return;
  }
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
  const originalValues = new Map(
    snapshot.entries.map((entry) => {
      const track = timeline.tracks.find((item) => item.id === entry.trackId);
      const keyframe = track?.keyframes.find(
        (item) => item.id === entry.keyframeId,
      );
      return [keyframeRefKey(entry), Number(keyframe?.value) || 0];
    }),
  );
  const svg = event.currentTarget.ownerSVGElement;
  const mapPointer = createGraphPointerMapper(svg);
  const startPointer = mapPointer(event);
  const startValue = originalValues.get(keyframeRefKey(primary)) ?? 0;
  const preview = createTimelineDragPreview(ctx, template);
  const onMove = (moveEvent) => {
    const pointer = mapPointer(moveEvent);
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
            updates: Object.fromEntries(
              snapshot.entries.map((entry) => [
                keyframeRefKey(entry),
                entry.time,
              ]),
            ),
          };
    if (
      !activateTimelineDrag(
        ctx,
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
        applyGraphTimePlan(timeline, snapshot, plan);
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
        const nextTime = plan.updates[keyframeRefKey(primary)];
        if (nextTime !== undefined) ctx.showTimelineSnapIndicator(nextTime);
      },
    );
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () =>
    preview.finalize(),
  );
}

export function installGraphEditorKeyframeDragOwner(
  ctx: ViewerAppContext,
): void {
  ctx.beginGraphKeyframeDrag = beginGraphKeyframeDrag.bind(undefined, ctx);
}
