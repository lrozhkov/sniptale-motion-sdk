import { admitTimelineRangeDrag } from "./range-drag-admission.js";
import type { TimelineRangeEditMode } from "../model/move-plan-model.js";
import type { EffectClip } from "../../../../sdk/types.js";
import type { EditorTemplate } from "../../templates/model.js";
import { bindViewerAction } from "../../app/bind-action.js";
import type { TimelinePointerActions } from "./pointer-contract.js";
import type { ViewerAppContext } from "../../app/context.js";
import { createTimelineDragPreview } from "./drag-preview.js";

function beginClipDrag(
  ctx: ViewerAppContext,
  event: PointerEvent,
  layerId: string,
  mode: TimelineRangeEditMode,
  measureElement: HTMLElement | null = null,
) {
  const target = admitTimelineRangeDrag(ctx, event, mode);
  if (!target) return;
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
  if (!template || !effectiveTemplate || !clip || clip.locked) {
    return;
  }
  const duration = ctx.getEffectiveDuration(template);
  const sceneWindow = getClipSceneWindow(effectiveTemplate, clip, duration);
  const body =
    measureElement ?? target.closest<HTMLElement>(".timeline-lane-body");
  if (!body) return;
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
      .filter((item) => item !== null);
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
  const onMove = (moveEvent: MouseEvent) => {
    const pointerDelta = moveEvent.clientX - startX;
    if (
      !preview.activate(Math.abs(pointerDelta), () =>
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
    if (clipMovePlan) {
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
  ctx.bindPointerDrag(event.pointerId, target, onMove, () =>
    preview.finalize(),
  );
}

function getClipSceneWindow(
  effectiveTemplate: EditorTemplate,
  clip: EffectClip,
  duration: number,
): { start: number; end: number } {
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

export function createClipDragActions(
  getContext: () => ViewerAppContext,
): Pick<TimelinePointerActions, "beginClipDrag"> {
  return { beginClipDrag: bindViewerAction(beginClipDrag, getContext) };
}
