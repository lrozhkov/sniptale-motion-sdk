import type { ViewerAppContext } from "../../app/context.js";
import { createTimelineDragPreview } from "./drag-preview.js";

function beginPhaseDrag(ctx: ViewerAppContext, event, phaseId, mode) {
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
  if (mode === "move" && !ctx.isSelectedPhase(phaseId)) {
    ctx.selectPhaseBlock(phaseId);
    ctx.setInspectorTab("timing");
  }
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const phase = timeline.phases.find((item) => item.id === phaseId);
  if (!template || !phase || phase.locked) {
    return;
  }
  const body =
    event.currentTarget.closest(".timeline-lane-body") ??
    event.currentTarget.parentElement;
  const rect = body.getBoundingClientRect();
  const startX = event.clientX;
  const original = { duration: phase.duration, start: phase.start };
  const selectedPhaseIds =
    mode === "move" && ctx.state.selectedPhases.includes(phaseId)
      ? ctx.state.selectedPhases
      : [phaseId];
  const phaseMovePlan =
    mode === "move"
      ? ctx.createPhaseMovePlan(
          ctx.getEffectiveTemplate(template),
          selectedPhaseIds,
          ctx.getEffectiveDuration(template),
          ctx.state.moveLinkedKeys,
        )
      : null;
  ctx.state.selectedPhases = mode === "move" ? selectedPhaseIds : [phaseId];
  ctx.state.selectedClips = [];
  ctx.state.selectedLayers = [];
  ctx.state.selectedScenes = [];
  ctx.state.selectedKeyframes = [];
  ctx.state.selectedItem = { phaseId, type: "phase" };
  const minDelta = phaseMovePlan?.minDelta ?? -original.start;
  const maxDelta =
    phaseMovePlan?.maxDelta ??
    ctx.getEffectiveDuration(template) - (original.start + original.duration);
  const preview = createTimelineDragPreview(ctx, template);
  const onMove = (moveEvent) => {
    const pointerDelta = moveEvent.clientX - startX;
    if (
      !preview.activate(Math.abs(pointerDelta), () =>
        ctx.beginEditorCommand({
          payload: {
            linkedKeys: ctx.state.moveLinkedKeys,
            mode,
            phaseId,
            phaseIds: mode === "move" ? selectedPhaseIds : [phaseId],
          },
          type: "movePhase",
        }),
      )
    ) {
      return;
    }
    const rawDelta = ctx.timelineDeltaFromPixels(pointerDelta, rect, template);
    const deltaTime =
      mode === "move" ? ctx.deps.clamp(rawDelta, minDelta, maxDelta) : rawDelta;
    if (phaseMovePlan) {
      preview.scheduleUpdate(
        () =>
          ctx.applyPhaseMovePlan(template, phaseMovePlan, deltaTime, {
            render: false,
          }),
        () => {
          const movedPhase = phaseMovePlan.timeline.phases.find(
            (item) => item.id === phaseId,
          );
          ctx.showTimelineSnapIndicator(movedPhase?.start ?? phase.start);
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
        ctx.getEffectiveDuration(template),
      );
      preview.scheduleUpdate(
        () => {
          phase.duration = nextDuration;
          phase.start = nextStart;
          ctx.state.timelineOverrides.set(
            template.id,
            ctx.deps.normalizeTimeline(
              timeline,
              ctx.getEffectiveDuration(template),
            ),
          );
        },
        () => ctx.showTimelineSnapIndicator(phase.start),
      );
      return;
    }
    const nextDuration = ctx.snapDuration(
      ctx.deps.clamp(
        original.duration + deltaTime,
        0.05,
        ctx.getEffectiveDuration(template) - original.start,
      ),
    );
    preview.scheduleUpdate(
      () => {
        phase.duration = nextDuration;
        ctx.state.timelineOverrides.set(
          template.id,
          ctx.deps.normalizeTimeline(
            timeline,
            ctx.getEffectiveDuration(template),
          ),
        );
      },
      () => ctx.showTimelineSnapIndicator(phase.start + phase.duration),
    );
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () =>
    preview.finalize(),
  );
}

function beginSceneDrag(ctx: ViewerAppContext, event, sceneId, mode) {
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
    event.currentTarget.closest(".timeline-lane-body") ??
    event.currentTarget.parentElement;
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
  const onMove = (moveEvent) => {
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
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () =>
    preview.finalize(),
  );
}

export function installInteractionPhaseSceneDragOwner(
  ctx: ViewerAppContext,
): void {
  ctx.beginPhaseDrag = beginPhaseDrag.bind(undefined, ctx);
  ctx.beginSceneDrag = beginSceneDrag.bind(undefined, ctx);
}
