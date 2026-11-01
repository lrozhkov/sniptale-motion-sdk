import { admitTimelineRangeDrag } from "./range-drag-admission.js";
import type { TimelineRangeEditMode } from "../model/move-plan-model.js";
import { bindViewerAction } from "../../app/bind-action.js";
import type { TimelinePointerActions } from "./pointer-contract.js";
import type { ViewerAppContext } from "../../app/context.js";
import { createTimelineDragPreview } from "./drag-preview.js";

function beginPhaseDrag(
  ctx: ViewerAppContext,
  event: PointerEvent,
  phaseId: string,
  mode: TimelineRangeEditMode,
) {
  const target = admitTimelineRangeDrag(ctx, event, mode);
  if (!target) return;
  if (mode === "move" && !ctx.isSelectedPhase(phaseId)) {
    ctx.selectPhaseBlock(phaseId);
    ctx.setInspectorTab("timing");
  }
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const phase = timeline.phases.find((item) => item.id === phaseId);
  if (!template || !effectiveTemplate || !phase || phase.locked) {
    return;
  }
  const body =
    target.closest<HTMLElement>(".timeline-lane-body") ?? target.parentElement;
  if (!body) return;
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
          effectiveTemplate,
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
  const onMove = (moveEvent: MouseEvent) => {
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
  ctx.bindPointerDrag(event.pointerId, target, onMove, () =>
    preview.finalize(),
  );
}

export function createPhaseDragActions(
  getContext: () => ViewerAppContext,
): Pick<TimelinePointerActions, "beginPhaseDrag"> {
  return { beginPhaseDrag: bindViewerAction(beginPhaseDrag, getContext) };
}
