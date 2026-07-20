import type { ViewerAppContext } from "../app/context.js";
import {
  activateTimelineDrag,
  createTimelineDragPreview,
} from "../timeline/interaction/drag-preview.js";
import { graphXToTime, graphYToValue } from "./model.js";
import {
  clampGraphValue,
  commitInteractiveGraphTimeline,
  createGraphPointerMapper,
} from "./interaction-shared.js";
import { getPairedMotionPathKeyframeRef } from "../timeline/model/motion-path-mutations.js";

function beginGraphBezierHandleDrag(
  ctx: ViewerAppContext,
  event,
  model,
  trackId,
  keyframeId,
  handleName,
) {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const track = timeline.tracks.find((item) => item.id === trackId);
  const ordered = [...(track?.keyframes ?? [])].sort(
    (left, right) => left.time - right.time,
  );
  const index = ordered.findIndex((keyframe) => keyframe.id === keyframeId);
  const keyframe = track?.keyframes.find((item) => item.id === keyframeId);
  const next = ordered[index + 1];
  if (!template || !track || !keyframe || !next) {
    return;
  }
  const start = { x: event.clientX, y: event.clientY };
  const svg = event.currentTarget.ownerSVGElement;
  const mapPointer = createGraphPointerMapper(svg);
  const preview = createTimelineDragPreview(ctx, template);
  const onMove = (moveEvent) => {
    const pointer = mapPointer(moveEvent);
    const normalized = resolveNormalizedHandle(
      pointer,
      model.viewport,
      keyframe,
      next,
    );
    if (
      !activateTimelineDrag(
        ctx,
        Math.abs(moveEvent.clientX - start.x) +
          Math.abs(moveEvent.clientY - start.y),
        () =>
          ctx.beginEditorCommand({
            payload: { handleName, keyframeId, trackId },
            type: "updateKeyframeHandles",
          }),
      )
    ) {
      return;
    }
    preview.scheduleUpdate(() => {
      const handles = ctx.deps.normalizeHandles(keyframe.handles);
      if (handleName === "first") {
        handles.x1 = normalized.x;
        handles.y1 = normalized.y;
        if (ctx.state.graphEditorLinkedHandles) {
          handles.x2 = 1 - normalized.x;
          handles.y2 = 1 - normalized.y;
        }
      } else {
        handles.x2 = normalized.x;
        handles.y2 = normalized.y;
        if (ctx.state.graphEditorLinkedHandles) {
          handles.x1 = 1 - normalized.x;
          handles.y1 = 1 - normalized.y;
        }
      }
      keyframe.handles = handles;
      keyframe.easing = "bezier";
      const pairedRef = getPairedMotionPathKeyframeRef(
        timeline,
        trackId,
        keyframeId,
      );
      const pairedTrack = pairedRef
        ? timeline.tracks.find((item) => item.id === pairedRef.trackId)
        : null;
      const pairedKeyframe = pairedTrack?.keyframes.find(
        (item) => item.id === pairedRef?.keyframeId,
      );
      if (pairedKeyframe) {
        pairedKeyframe.handles = { ...handles };
        pairedKeyframe.easing = "bezier";
      }
      commitInteractiveGraphTimeline(ctx, template, timeline);
    });
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () =>
    preview.finalize(),
  );
}

function resolveNormalizedHandle(pointer, viewport, keyframe, next) {
  const time = graphXToTime(pointer.x, viewport);
  const value = graphYToValue(pointer.y, viewport);
  const deltaValue = next.value - keyframe.value;
  return {
    x: clampGraphValue(
      (time - keyframe.time) / Math.max(0.0001, next.time - keyframe.time),
      0,
      1,
    ),
    y: clampGraphValue(
      Math.abs(deltaValue) < 0.0001
        ? 0.5
        : (value - keyframe.value) / deltaValue,
      0,
      1,
    ),
  };
}

export function installGraphEditorHandleDragOwner(ctx: ViewerAppContext): void {
  ctx.beginGraphBezierHandleDrag = (...args: any[]) =>
    (beginGraphBezierHandleDrag as any)(ctx, ...args);
}
