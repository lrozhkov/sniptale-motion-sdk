import type { ViewerAppContext } from "../../app/context.js";
import {
  activateTimelineDrag,
  createTimelineDragPreview,
} from "./drag-preview.js";

function beginClipDrag(
  ctx: ViewerAppContext,
  event,
  layerId,
  mode,
  measureElement = null,
) {
  if (event.button !== 0) {
    return;
  }
  if (event.altKey || event.shiftKey) {
    ctx.beginTimelineMarqueeSelection(event, { allowBlockStart: true });
    return;
  }
  if (mode === "move" && (event.shiftKey || event.metaKey || event.ctrlKey)) {
    return;
  }
  if (mode === "move" && !ctx.isSelectedClip(layerId)) {
    ctx.selectClipBlock(layerId);
    ctx.setInspectorTab("timing");
  }
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const clips = ctx.deps.deepClone(effectiveTemplate?.clips ?? []);
  const clip = clips.find((item) => item.layerId === layerId);
  if (!template || !clip || clip.locked) {
    return;
  }
  const duration = ctx.getEffectiveDuration(template);
  const sceneWindow = getClipSceneWindow(effectiveTemplate, clip, duration);
  const body =
    measureElement ?? event.currentTarget.closest(".timeline-lane-body");
  const rect = body.getBoundingClientRect();
  const startX = event.clientX;
  const original = { duration: clip.duration, start: clip.start };
  const selectedLayerIds =
    mode === "move" && ctx.state.selectedClips.includes(layerId)
      ? ctx.state.selectedClips
      : [layerId];
  const clipMovePlan =
    mode === "move"
      ? ctx.createClipMovePlan(
          effectiveTemplate,
          selectedLayerIds,
          duration,
          true,
        )
      : null;
  const originals =
    clipMovePlan?.clipItems ??
    selectedLayerIds
      .map((id) => {
        const selectedClip = clips.find((item) => item.layerId === id);
        return selectedClip && !selectedClip.locked
          ? {
              clip: selectedClip,
              duration: selectedClip.duration,
              layerId: selectedClip.layerId,
              start: selectedClip.start,
            }
          : null;
      })
      .filter(Boolean);
  ctx.state.selectedClips =
    mode === "move" ? originals.map((item) => item.layerId) : [layerId];
  ctx.state.selectedLayers = [];
  ctx.state.selectedPhases = [];
  ctx.state.selectedScenes = [];
  ctx.state.selectedItem = { layerId, type: "clip" };
  ctx.state.selectedKeyframes = [];
  const minDelta = clipMovePlan?.minDelta ?? -original.start;
  const maxDelta =
    clipMovePlan?.maxDelta ?? duration - (original.start + original.duration);
  const preview = createTimelineDragPreview(ctx, template);
  const onMove = (moveEvent) => {
    const pointerDelta = moveEvent.clientX - startX;
    if (
      !activateTimelineDrag(ctx, Math.abs(pointerDelta), () =>
        ctx.beginEditorCommand({
          payload: {
            layerId,
            layerIds:
              mode === "move"
                ? originals.map((item) => item.layerId)
                : [layerId],
            linkedKeys: mode === "move",
            mode,
          },
          type: "moveClip",
        }),
      )
    ) {
      return;
    }
    const rawDelta = ctx.timelineDeltaFromPixels(pointerDelta, rect, template);
    const deltaTime =
      mode === "move" ? ctx.deps.clamp(rawDelta, minDelta, maxDelta) : rawDelta;
    if (mode === "move") {
      preview.scheduleUpdate(
        () =>
          ctx.applyClipMovePlan(template, clipMovePlan, deltaTime, {
            render: false,
          }),
        () => {
          const movedClip = clipMovePlan.clips.find(
            (item) => item.layerId === layerId,
          );
          ctx.showTimelineSnapIndicator(movedClip?.start ?? clip.start);
        },
      );
      return;
    }
    if (mode === "start") {
      const nextStart = ctx.snapTime(
        ctx.deps.clamp(
          original.start + deltaTime,
          sceneWindow.start,
          Math.min(
            original.start + original.duration - 0.05,
            sceneWindow.end - 0.05,
          ),
        ),
      );
      const nextDuration = ctx.deps.clamp(
        original.duration + original.start - nextStart,
        0.05,
        sceneWindow.end - nextStart,
      );
      preview.scheduleUpdate(
        () => {
          clip.duration = nextDuration;
          clip.start = nextStart;
          ctx.setEditorOverride({ clips });
        },
        () => ctx.showTimelineSnapIndicator(clip.start),
      );
      return;
    }
    const nextDuration = ctx.snapDuration(
      ctx.deps.clamp(
        original.duration + deltaTime,
        0.05,
        sceneWindow.end - original.start,
      ),
    );
    preview.scheduleUpdate(
      () => {
        clip.duration = nextDuration;
        ctx.setEditorOverride({ clips });
      },
      () => ctx.showTimelineSnapIndicator(clip.start + clip.duration),
    );
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () =>
    preview.finalize(),
  );
}

function getClipSceneWindow(effectiveTemplate, clip, duration) {
  const scene = clip?.sceneId
    ? (effectiveTemplate?.scenes ?? []).find((item) => item.id === clip.sceneId)
    : null;
  if (!scene) {
    return { end: duration, start: 0 };
  }
  const start = Number(scene.start) || 0;
  return {
    end: Math.min(duration, start + (Number(scene.duration) || 0)),
    start,
  };
}

export function installInteractionClipDragOwner(ctx: ViewerAppContext): void {
  ctx.beginClipDrag = beginClipDrag.bind(undefined, ctx);
}
