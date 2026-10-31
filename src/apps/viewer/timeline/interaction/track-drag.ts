import { bindViewerAction } from "../../app/bind-action.js";
import type { TimelinePointerActions } from "./pointer-contract.js";
import type { ViewerAppContext } from "../../app/context.js";
import { calculateTrackDragBounds } from "../model/track-drag-bounds.js";
import { createTimelineDragPreview } from "./drag-preview.js";

function beginTrackDrag(
  ctx: ViewerAppContext,
  event: PointerEvent,
  trackId: string,
  measureElement: HTMLElement | null = null,
  sceneId: string | null = null,
  keyframeIds: readonly string[] | null = null,
) {
  if (event.button !== 0) {
    return;
  }
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  ctx.state.pointerDragCleanup?.();
  if (
    event.target instanceof Element &&
    event.target.closest("button, input, select, textarea")
  ) {
    return;
  }
  if (event.altKey && !measureElement) {
    ctx.beginTimelineMarqueeSelection(event);
    return;
  }
  if (!measureElement && event.target !== event.currentTarget) {
    return;
  }
  if (
    ctx.state.selectedItem?.type !== "track" ||
    ctx.state.selectedItem.trackId !== trackId
  ) {
    ctx.selectTrackLane(trackId);
    ctx.setInspectorTab("timing");
  }
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const track = timeline.tracks.find((item) => item.id === trackId);
  if (!template || !track || track.keyframes.length === 0) {
    return;
  }
  const scene = sceneId
    ? ctx
        .normalizeScenes(
          ctx.getEffectiveTemplate(template)?.scenes ?? [],
          ctx.getEffectiveDuration(template),
        )
        .find((item) => item.id === sceneId)
    : null;
  const laneKeyframeIds = keyframeIds ? new Set(keyframeIds) : null;
  const movableKeyframes = laneKeyframeIds
    ? track.keyframes.filter((keyframe) => laneKeyframeIds.has(keyframe.id))
    : scene
      ? track.keyframes.filter((keyframe) =>
          ctx.keyframeBelongsToScene(track, keyframe, scene),
        )
      : track.keyframes;
  if (movableKeyframes.length === 0) {
    return;
  }
  ctx.state.selectedClips = [];
  ctx.state.selectedLayers = [];
  ctx.state.selectedPhases = [];
  ctx.state.selectedScenes = [];
  ctx.state.selectedKeyframes = [];
  ctx.state.selectedItem = { trackId, type: "track" };
  const rect = (measureElement ?? target).getBoundingClientRect();
  const startX = event.clientX;
  const originals = movableKeyframes.map((keyframe) => ({
    id: keyframe.id,
    time: keyframe.time,
  }));
  const dragBounds = calculateTrackDragBounds({
    duration: ctx.getEffectiveDuration(template),
    keyframes: movableKeyframes,
    phaseById: new Map(
      (timeline.phases ?? []).map((phase) => [phase.id, phase]),
    ),
    scene,
    track,
  });
  const preview = createTimelineDragPreview(ctx, template);
  const onMove = (moveEvent: MouseEvent) => {
    const pointerDelta = moveEvent.clientX - startX;
    if (
      !preview.activate(Math.abs(pointerDelta), () =>
        ctx.beginEditorCommand({
          payload: {
            keyframes: originals.map((item) => item.id),
            sceneId,
            trackId,
          },
          type: "moveTrack",
        }),
      )
    ) {
      return;
    }
    const duration = ctx.getEffectiveDuration(template);
    const rawDelta = ctx.timelineDeltaFromPixels(pointerDelta, rect, template);
    const deltaTime = ctx.deps.clamp(
      rawDelta,
      dragBounds.minDelta,
      dragBounds.maxDelta,
    );
    preview.scheduleUpdate(
      () => {
        for (const original of originals) {
          const keyframe = track.keyframes.find(
            (item) => item.id === original.id,
          );
          if (keyframe) {
            keyframe.time = ctx.snapTime(
              ctx.deps.clamp(original.time + deltaTime, 0, duration),
            );
          }
        }
        track.keyframes.sort((a, b) => a.time - b.time);
        ctx.state.timelineOverrides.set(
          template.id,
          ctx.deps.normalizeTimeline(timeline, duration),
        );
      },
      () => {
        const primary = track.keyframes.find(
          (item) => item.id === originals[0]?.id,
        );
        if (primary) {
          ctx.showTimelineSnapIndicator(primary.time);
        }
      },
    );
  };
  ctx.bindPointerDrag(event.pointerId, target, onMove, () =>
    preview.finalize(),
  );
}

export function createTrackDragActions(
  getContext: () => ViewerAppContext,
): Pick<TimelinePointerActions, "beginTrackDrag"> {
  return { beginTrackDrag: bindViewerAction(beginTrackDrag, getContext) };
}
