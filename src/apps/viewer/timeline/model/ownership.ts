import { bindViewerAction } from "../../app/bind-action.js";
import {
  findTemplateScene,
  findTemplatePhase,
} from "../../templates/fallbacks.js";
import type { EditorTemplate } from "../../templates/model.js";
import type { MotionPathTrack } from "../../../../shared/timeline/motion-path.js";
import type {
  TimelineKeyframe,
  TimelinePhase,
  EffectScene,
} from "../../../../sdk/types.js";

import type { ViewerAppContext } from "../../app/context.js";

function frameTimelineRange(
  ctx: ViewerAppContext,
  start: number,
  end: number,
  duration: number,
): void {
  const nextState = ctx.deps.calculateFrameTimelineRangeState(
    start,
    end,
    duration,
  );
  ctx.state.timelineZoom = nextState.zoom;
  ctx.state.timelineOffset = nextState.offset;
  ctx.seekToTime(
    ctx.deps.clamp(nextState.center, 0, Math.max(0.001, Number(duration) || 1)),
  );
}
function isTimeInsideRange(
  _ctx: ViewerAppContext,
  time: number,
  start: number,
  end: number,
): boolean {
  return time >= start - 0.0001 && time <= end + 0.0001;
}
function isRangeInsideScene(
  ctx: ViewerAppContext,
  start: number,
  duration: number,
  scene: EffectScene | null | undefined,
): boolean {
  if (!scene) {
    return false;
  }
  return (
    start >= scene.start - ctx.deps.TIMING_BOUNDARY_TOLERANCE &&
    start + duration <=
      scene.start + scene.duration + ctx.deps.TIMING_BOUNDARY_TOLERANCE
  );
}
function isPhaseSceneBoundaryInvalid(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  phase: TimelinePhase | null | undefined,
): boolean {
  if (!phase?.sceneId) {
    return false;
  }
  const scene = findTemplateScene(ctx, template, phase.sceneId);
  return Boolean(
    scene &&
    !ctx.isRangeInsideScene(
      Number(phase.start) || 0,
      Number(phase.duration) || 0,
      scene,
    ),
  );
}
function isKeyframeTimingInvalid(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  track: MotionPathTrack,
  keyframe: TimelineKeyframe<unknown>,
): boolean {
  const time = Number(keyframe?.time);
  if (
    !Number.isFinite(time) ||
    time < 0 ||
    time > Number(template?.duration || 0)
  ) {
    return true;
  }
  const phase = findTemplatePhase(
    ctx,
    template,
    keyframe?.phaseId ?? track?.phaseId,
  );
  if (
    phase &&
    !ctx.isTimeInsideBoundaryRange(
      time,
      Number(phase.start) || 0,
      (Number(phase.start) || 0) + (Number(phase.duration) || 0),
    )
  ) {
    return true;
  }
  const sceneId = ctx.getKeyframeOwnershipSceneId(
    template?.timeline,
    track,
    keyframe,
  );
  const scene = findTemplateScene(ctx, template, sceneId);
  return Boolean(
    scene &&
    !ctx.isTimeInsideBoundaryRange(
      time,
      scene.start,
      scene.start + scene.duration,
    ),
  );
}
function isTimeInsideBoundaryRange(
  ctx: ViewerAppContext,
  time: number,
  start: number,
  end: number,
): boolean {
  return (
    time >= start - ctx.deps.TIMING_BOUNDARY_TOLERANCE &&
    time <= end + ctx.deps.TIMING_BOUNDARY_TOLERANCE
  );
}
function isRangeInvalid(
  ctx: ViewerAppContext,
  start: number,
  duration: number,
  totalDuration: number,
): boolean {
  return ctx.deps.isRangeInvalidModel(start, duration, totalDuration);
}
function hasInvalidTiming(
  ctx: ViewerAppContext,
  template: EditorTemplate,
): boolean {
  return ctx.deps.hasInvalidTimingModel(
    template,
    ctx.createEditorValidationOptions(),
  );
}

export function createTimelineRangeActions(getContext: () => ViewerAppContext) {
  return {
    frameTimelineRange: bindViewerAction(frameTimelineRange, getContext),
    isTimeInsideRange: bindViewerAction(isTimeInsideRange, getContext),
    isRangeInsideScene: bindViewerAction(isRangeInsideScene, getContext),
    isPhaseSceneBoundaryInvalid: bindViewerAction(
      isPhaseSceneBoundaryInvalid,
      getContext,
    ),
    isKeyframeTimingInvalid: bindViewerAction(
      isKeyframeTimingInvalid,
      getContext,
    ),
    isTimeInsideBoundaryRange: bindViewerAction(
      isTimeInsideBoundaryRange,
      getContext,
    ),
    isRangeInvalid: bindViewerAction(isRangeInvalid, getContext),
    hasInvalidTiming: bindViewerAction(hasInvalidTiming, getContext),
  };
}
