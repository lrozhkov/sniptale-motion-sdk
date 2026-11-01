import { admitTimelineRangeDrag } from "./range-drag-admission.js";
import type { TimelineRangeEditMode } from "../model/move-plan-model.js";
import { bindViewerAction } from "../../app/bind-action.js";
import type { TimelinePointerActions } from "./pointer-contract.js";
import type { ViewerAppContext } from "../../app/context.js";
import { createTimelineDragPreview } from "./drag-preview.js";

function beginSceneDrag(
  ctx: ViewerAppContext,
  event: PointerEvent,
  sceneId: string,
  mode: TimelineRangeEditMode,
) {
  const target = admitTimelineRangeDrag(ctx, event, mode);
  if (!target) return;
  if (mode === "move" && !ctx.isSelectedScene(sceneId)) {
    ctx.selectSceneBlock(sceneId);
    ctx.setInspectorTab("timing");
  }
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const totalDuration = ctx.getEffectiveDuration(template);
  const scenes = ctx.normalizeScenes(
    effectiveTemplate?.scenes ?? [],
    totalDuration,
  );
  const scene = scenes.find((item) => item.id === sceneId);
  if (!template || !effectiveTemplate || !scene || scene.locked) {
    return;
  }
  const body =
    target.closest<HTMLElement>(".timeline-lane-body") ?? target.parentElement;
  if (!body) return;
  const rect = body.getBoundingClientRect();
  const startX = event.clientX;
  const original = { duration: scene.duration, start: scene.start };
  const selectedSceneIds =
    mode === "move" && ctx.state.selectedScenes.includes(sceneId)
      ? ctx.state.selectedScenes
      : [sceneId];
  const sceneMovePlan =
    mode === "move"
      ? ctx.createSceneMovePlan(
          effectiveTemplate,
          selectedSceneIds,
          totalDuration,
          ctx.state.moveLinkedKeys,
        )
      : null;
  const originals =
    sceneMovePlan?.sceneItems ??
    selectedSceneIds
      .map((id) => {
        const selectedScene = scenes.find((item) => item.id === id);
        return selectedScene && !selectedScene.locked
          ? {
              duration: selectedScene.duration,
              scene: selectedScene,
              sceneId: selectedScene.id,
              start: selectedScene.start,
            }
          : null;
      })
      .filter((item) => item !== null);
  ctx.state.selectedScenes =
    mode === "move" ? originals.map((item) => item.sceneId) : [sceneId];
  ctx.state.selectedClips = [];
  ctx.state.selectedLayers = [];
  ctx.state.selectedPhases = [];
  ctx.state.selectedKeyframes = [];
  ctx.state.selectedItem = { sceneId, type: "scene" };
  const minDelta = sceneMovePlan?.minDelta ?? -original.start;
  const maxDelta =
    sceneMovePlan?.maxDelta ??
    totalDuration - (original.start + original.duration);
  const preview = createTimelineDragPreview(ctx, template);
  const onMove = (moveEvent: MouseEvent) => {
    const pointerDelta = moveEvent.clientX - startX;
    if (
      !preview.activate(Math.abs(pointerDelta), () =>
        ctx.beginEditorCommand({
          payload: {
            linkedKeys: ctx.state.moveLinkedKeys,
            mode,
            sceneId,
            sceneIds:
              mode === "move"
                ? originals.map((item) => item.sceneId)
                : [sceneId],
          },
          type: "moveScene",
        }),
      )
    ) {
      return;
    }
    const rawDelta = ctx.timelineDeltaFromPixels(pointerDelta, rect, template);
    const deltaTime =
      mode === "move" ? ctx.deps.clamp(rawDelta, minDelta, maxDelta) : rawDelta;
    if (sceneMovePlan) {
      preview.scheduleUpdate(
        () =>
          ctx.applySceneMovePlan(template, sceneMovePlan, deltaTime, {
            render: false,
          }),
        () => {
          const movedScene = sceneMovePlan.scenes.find(
            (item) => item.id === sceneId,
          );
          ctx.showTimelineSnapIndicator(movedScene?.start ?? scene.start);
        },
      );
      return;
    }
    if (mode === "start") {
      const nextStart = ctx.snapTime(
        ctx.deps.clamp(
          original.start + deltaTime,
          0,
          original.start + original.duration - 0.05,
        ),
      );
      const nextDuration = ctx.deps.clamp(
        original.duration + original.start - nextStart,
        0.05,
        totalDuration,
      );
      preview.scheduleUpdate(
        () => {
          scene.duration = nextDuration;
          scene.start = nextStart;
          ctx.setEditorOverride({ scenes });
        },
        () => ctx.showTimelineSnapIndicator(scene.start),
      );
      return;
    }
    const nextDuration = ctx.snapDuration(
      ctx.deps.clamp(
        original.duration + deltaTime,
        0.05,
        totalDuration - original.start,
      ),
    );
    preview.scheduleUpdate(
      () => {
        scene.duration = nextDuration;
        ctx.setEditorOverride({ scenes });
      },
      () => ctx.showTimelineSnapIndicator(scene.start + scene.duration),
    );
  };
  ctx.bindPointerDrag(event.pointerId, target, onMove, () =>
    preview.finalize(),
  );
}

export function createSceneDragActions(
  getContext: () => ViewerAppContext,
): Pick<TimelinePointerActions, "beginSceneDrag"> {
  return { beginSceneDrag: bindViewerAction(beginSceneDrag, getContext) };
}
