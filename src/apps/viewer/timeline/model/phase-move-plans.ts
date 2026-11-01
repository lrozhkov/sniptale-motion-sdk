import { applyLinkedTimelineMove } from "./linked-move.js";
import { keyframeRefKey } from "./keyframe-reference.js";
import { bindViewerAction } from "../../app/bind-action.js";
import type { EditorTemplate } from "../../templates/model.js";

import type {
  PhaseMovePlan,
  MovePlanOptions,
  KeyframeMoveItem,
  TimelineWindow,
} from "./move-plan-model.js";
import type { ViewerAppContext } from "../../app/context.js";

function createPhaseMovePlan(
  ctx: ViewerAppContext,
  effectiveTemplate: EditorTemplate | null | undefined,
  phaseIds: string[],
  totalDuration: number,
  includeLinkedKeys = true,
): PhaseMovePlan {
  const timeline = ctx.deps.deepClone(
    effectiveTemplate?.timeline ?? {
      duration: totalDuration,
      phases: [],
      tracks: [],
    },
  );
  const selected = new Set(phaseIds);
  const rawPhaseItems = (timeline.phases ?? [])
    .filter((phase) => selected.has(phase.id) && !phase.locked)
    .map((phase) => ({
      duration: Number(phase.duration) || 0.05,
      phase,
      phaseId: phase.id,
      start: Number(phase.start) || 0,
    }));
  const keyframeItems: KeyframeMoveItem[] = [];
  const bounds: TimelineWindow[] = [];
  const addBound = (start: number, end = start) => bounds.push({ end, start });
  const seenKeyframes = new Set();
  const keyframedPhaseIds = new Set();
  if (includeLinkedKeys) {
    (timeline.tracks ?? []).forEach((track) => {
      (track.keyframes ?? []).forEach((keyframe) => {
        const key = keyframeRefKey({
          trackId: track.id,
          keyframeId: keyframe.id,
        });
        const phaseId =
          typeof keyframe?.phaseId === "string"
            ? keyframe.phaseId
            : track.phaseId;
        if (
          seenKeyframes.has(key) ||
          !ctx.keyframeBelongsToSelectedPhase(keyframe, track, selected)
        ) {
          return;
        }
        seenKeyframes.add(key);
        if (phaseId) {
          keyframedPhaseIds.add(phaseId);
        }
        const time = Number(keyframe.time) || 0;
        keyframeItems.push({
          keyframe,
          keyframeId: keyframe.id,
          time,
          track,
          trackId: track.id,
        });
        addBound(time);
      });
    });
  }
  const phaseItems = rawPhaseItems.filter(
    (item) => !keyframedPhaseIds.has(item.phaseId),
  );
  phaseItems.forEach((item) =>
    addBound(item.start, item.start + item.duration),
  );
  const minStart = bounds.length
    ? Math.min(...bounds.map((item) => item.start))
    : 0;
  const maxEnd = bounds.length
    ? Math.max(...bounds.map((item) => item.end))
    : totalDuration;
  return {
    keyframeItems,
    maxDelta: totalDuration - maxEnd,
    minDelta: -minStart,
    phaseItems,
    timeline,
  };
}

function applyPhaseMovePlan(
  ctx: ViewerAppContext,
  template: { id: string } | null | undefined,
  plan: PhaseMovePlan | null | undefined,
  deltaTime: number,
  options: MovePlanOptions = {},
): void {
  if (!template || !plan) {
    return;
  }
  const totalDuration = ctx.getEffectiveDuration(template);
  const delta =
    ctx.snapDuration(Math.abs(deltaTime)) * Math.sign(deltaTime || 0);
  applyLinkedTimelineMove(ctx, plan, delta, totalDuration);
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(plan.timeline, totalDuration),
  );
  if (options.render === false) {
    return;
  }
  ctx.renderTimelineEditor(template);
  void ctx.renderCurrentFrame();
}

export function createPhaseMoveActions(getContext: () => ViewerAppContext) {
  return {
    createPhaseMovePlan: bindViewerAction(createPhaseMovePlan, getContext),
    applyPhaseMovePlan: bindViewerAction(applyPhaseMovePlan, getContext),
  };
}
