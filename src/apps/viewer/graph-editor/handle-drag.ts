import { bindViewerAction } from "../app/bind-action.js";
import type { GraphRuntimeActions } from "./contract.js";
import type { GraphEditorViewport } from "./state.js";
import type { GraphCoordinates, GraphEditorModel } from "./model-types.js";
import {
  readGraphPointerTarget,
  createGraphPointerMapper,
} from "./pointer-coordinates.js";
import type { ViewerAppContext } from "../app/context.js";
import { createTimelineDragPreview } from "../timeline/interaction/drag-preview.js";
import { graphXToTime, graphYToValue } from "./viewport.js";
import {
  clampGraphValue,
  commitInteractiveGraphTimeline,
} from "./interaction-shared.js";
import { getPairedMotionPathKeyframeRef } from "../timeline/model/motion-path-mutations.js";

function beginGraphBezierHandleDrag(
  ctx: ViewerAppContext,
  event: PointerEvent,
  model: GraphEditorModel,
  trackId: string,
  keyframeId: string,
  handleName: "first" | "second",
) {
  if (ctx.state.currentTemplate !== model.template) return;
  if (event.button !== 0) {
    return;
  }
  const surface = readGraphPointerTarget(event);
  if (!surface) return;
  const { target, svg } = surface;
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
  if (
    typeof keyframe.value !== "number" ||
    !Number.isFinite(keyframe.value) ||
    typeof next.value !== "number" ||
    !Number.isFinite(next.value)
  )
    return;
  const initial = { time: keyframe.time, value: keyframe.value };
  const following = { time: next.time, value: next.value };
  const start = { x: event.clientX, y: event.clientY };
  const mapPointer = createGraphPointerMapper(svg);
  const preview = createTimelineDragPreview(ctx, template);
  const onMove = (moveEvent: MouseEvent) => {
    const pointer = mapPointer(moveEvent);
    if (!pointer) return;
    const normalized = resolveNormalizedHandle(
      pointer,
      model.viewport,
      initial,
      following,
    );
    if (
      !preview.activate(
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
  ctx.bindPointerDrag(event.pointerId, target, onMove, () =>
    preview.finalize(),
  );
}

function resolveNormalizedHandle(
  pointer: { x: number; y: number },
  viewport: GraphEditorViewport,
  keyframe: GraphCoordinates,
  next: GraphCoordinates,
) {
  const time = graphXToTime(pointer.x, viewport);
  const value = graphYToValue(pointer.y, viewport);
  const initialValue = keyframe.value;
  const deltaValue = next.value - initialValue;
  return {
    x: clampGraphValue(
      (time - keyframe.time) / Math.max(0.0001, next.time - keyframe.time),
      0,
      1,
    ),
    y: clampGraphValue(
      Math.abs(deltaValue) < 0.0001 ? 0.5 : (value - initialValue) / deltaValue,
      0,
      1,
    ),
  };
}

export function createGraphHandleDragActions(
  getContext: () => ViewerAppContext,
): Pick<GraphRuntimeActions, "beginGraphBezierHandleDrag"> {
  return {
    beginGraphBezierHandleDrag: bindViewerAction(
      beginGraphBezierHandleDrag,
      getContext,
    ),
  };
}
