import type { ViewerAppContext } from "../../app/context.js";
import {
  activateTimelineDrag,
  createTimelineDragPreview,
} from "./drag-preview.js";
import {
  createKeyframeMovePlan,
  createKeyframeTimeSnapshot,
} from "../model/keyframe-transform.js";
import { expandMotionPathKeyframeSelection } from "../model/motion-path-mutations.js";

function beginKeyframeDrag(
  ctx: ViewerAppContext,
  event: PointerEvent,
  trackId: string,
  keyframeId: string,
) {
  if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey) {
    return;
  }
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement) || !target.parentElement) return;
  event.preventDefault();
  event.stopPropagation();
  ctx.prepareKeyframeSelectionForPointer(event, trackId, keyframeId);
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const track = timeline.tracks.find((item) => item.id === trackId);
  if (!template || !track) {
    return;
  }
  ctx.setSelectedKeyframes(
    expandMotionPathKeyframeSelection(timeline, ctx.getSelectedKeyframeRefs()),
    { render: false },
  );
  ctx.renderInspector();
  ctx.renderCurveEditor(timeline);
  const body = target.parentElement;
  const rect = body.getBoundingClientRect();
  const startX = event.clientX;
  const selectedRefs = ctx.getSelectedKeyframeRefs();
  const originals = selectedRefs
    .map((ref) => {
      const selectedTrack = timeline.tracks.find(
        (item) => item.id === ref.trackId,
      );
      const selectedKeyframe = selectedTrack?.keyframes.find(
        (item) => item.id === ref.keyframeId,
      );
      return selectedTrack && selectedKeyframe
        ? {
            keyframeId: selectedKeyframe.id,
            time: selectedKeyframe.time,
            track: selectedTrack,
            trackId: selectedTrack.id,
          }
        : null;
    })
    .filter((entry) => entry !== null);
  if (originals.length === 0) {
    return;
  }
  const snapshot = createKeyframeTimeSnapshot(
    timeline,
    selectedRefs,
    ctx.getEffectiveDuration(template),
    1 / Math.max(1, Number(ctx.refs.fpsInput.value) || 30),
  );
  if (!snapshot) {
    return;
  }
  const preview = createTimelineDragPreview(ctx, template);
  const onMove = (moveEvent: PointerEvent) => {
    const pointerDelta = moveEvent.clientX - startX;
    const rawDelta = ctx.timelineDeltaFromPixels(pointerDelta, rect, template);
    const primary = snapshot.entries.at(-1);
    const deltaTime = primary
      ? ctx.snapTime(primary.time + rawDelta) - primary.time
      : rawDelta;
    const plan = createKeyframeMovePlan(snapshot, deltaTime);
    if (!plan.ok) {
      return;
    }
    if (
      !activateTimelineDrag(ctx, Math.abs(pointerDelta), () =>
        ctx.beginEditorCommand({
          payload: {
            keyframes: originals.map((item) => ({
              keyframeId: item.keyframeId,
              trackId: item.trackId,
            })),
          },
          type: "moveKeyframes",
        }),
      )
    ) {
      return;
    }
    let primaryTime = primary?.time ?? 0;
    preview.scheduleUpdate(
      () => {
        for (const entry of plan.updates) {
          const selectedTrack = timeline.tracks.find(
            (item) => item.id === entry.trackId,
          );
          const keyframe = selectedTrack?.keyframes.find(
            (item) => item.id === entry.keyframeId,
          );
          const nextTime = entry.time;
          if (keyframe && nextTime !== undefined) {
            keyframe.time = nextTime;
            if (
              entry.trackId === primary?.trackId &&
              entry.keyframeId === primary.keyframeId
            ) {
              primaryTime = keyframe.time;
            }
          }
          selectedTrack?.keyframes.sort((a, b) => a.time - b.time);
        }
        ctx.state.timelineOverrides.set(
          template.id,
          ctx.deps.normalizeTimeline(
            timeline,
            ctx.getEffectiveDuration(template),
          ),
        );
      },
      () => ctx.showTimelineSnapIndicator(primaryTime),
    );
  };
  ctx.bindPointerDrag(event.pointerId, target, onMove, () =>
    preview.finalize(),
  );
}

export function installInteractionKeyframeDragOwner(
  ctx: ViewerAppContext,
): void {
  ctx.beginKeyframeDrag = beginKeyframeDrag.bind(undefined, ctx);
}
