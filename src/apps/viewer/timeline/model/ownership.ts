import type { ViewerAppContext } from "../../app/context.js";

function createSelectedKeyframeSegmentRange(
  ctx: ViewerAppContext,
  track,
  visibleKeyframes,
  duration,
) {
  const selected = ctx.getPrimaryKeyframeSelection();
  if (
    !selected ||
    selected.trackId !== track.id ||
    !visibleKeyframes.some((keyframe) => keyframe.id === selected.keyframeId)
  ) {
    return null;
  }
  const keyframes = [...(track.keyframes ?? [])].sort(
    (a, b) => a.time - b.time,
  );
  const index = keyframes.findIndex(
    (keyframe) => keyframe.id === selected.keyframeId,
  );
  const from = index >= 0 ? keyframes[index] : null;
  const to =
    index >= 0 && index < keyframes.length - 1 ? keyframes[index + 1] : null;
  if (!from || !to || to.time <= from.time) {
    return null;
  }
  const range = document.createElement("div");
  range.className = "keyframe-segment-range";
  range.dataset.trackId = track.id;
  range.dataset.fromKeyframeId = from.id;
  range.dataset.toKeyframeId = to.id;
  range.title = ctx.deps
    .t("viewer.timeline.curveSegmentRange", "Curve segment {start} → {end}")
    .replace("{start}", ctx.formatSeconds(from.time))
    .replace("{end}", ctx.formatSeconds(to.time));
  range.style.left = `${ctx.timelinePercent(from.time, duration)}%`;
  range.style.width = `${Math.max(0.2, ctx.timelinePercent(to.time, duration) - ctx.timelinePercent(from.time, duration))}%`;
  range.addEventListener("pointerdown", (event) =>
    ctx.beginKeyframeSegmentDrag(event, track.id, from.id, to.id, "move"),
  );
  const startEdge = document.createElement("span");
  startEdge.className = "keyframe-segment-edge start";
  startEdge.addEventListener("pointerdown", (event) =>
    ctx.beginKeyframeSegmentDrag(event, track.id, from.id, to.id, "start"),
  );
  const endEdge = document.createElement("span");
  endEdge.className = "keyframe-segment-edge end";
  endEdge.addEventListener("pointerdown", (event) =>
    ctx.beginKeyframeSegmentDrag(event, track.id, from.id, to.id, "end"),
  );
  range.append(startEdge, endEdge);
  return range;
}
function getSelectedTimelineRange(ctx: ViewerAppContext, template) {
  const item = ctx.state.selectedItem ?? { type: "effect" };
  const timeline = template.timeline ?? { phases: [], tracks: [] };
  if (item.type === "scene") {
    const scene = ctx
      .normalizeScenes(template.scenes ?? [], template.duration)
      .find((entry) => entry.id === item.sceneId);
    return scene
      ? {
          end: scene.start + scene.duration,
          sceneId: scene.id,
          selector: `.scene-block[data-scene-id="${ctx.cssEscape(scene.id)}"]`,
          start: scene.start,
        }
      : null;
  }
  if (item.type === "clip" || item.type === "layer") {
    const clip = (template.clips ?? []).find(
      (entry) => entry.layerId === item.layerId,
    );
    if (item.type === "layer" && !clip) {
      const sceneId = ctx.normalizeScenes(
        template.scenes ?? [],
        template.duration,
      )[0]?.id;
      return {
        end: template.duration,
        sceneId: sceneId ?? null,
        selector: `.timeline-lane.layer-lane[data-layer-id="${ctx.cssEscape(item.layerId)}"]`,
        start: 0,
      };
    }
    const scenes = ctx.normalizeScenes(
      template.scenes ?? [],
      template.duration,
    );
    const sceneId =
      clip && ctx.isGlobalTimelineClip(clip, scenes)
        ? null
        : (clip?.sceneId ??
          ctx.findSceneIdAtTime(ctx.state.currentTemplate, clip?.start ?? 0));
    return clip
      ? {
          end: clip.start + clip.duration,
          sceneId,
          selector:
            item.type === "layer"
              ? `.timeline-lane.layer-lane[data-layer-id="${ctx.cssEscape(clip.layerId)}"]`
              : `.clip-block[data-layer-id="${ctx.cssEscape(clip.layerId)}"]`,
          start: clip.start,
        }
      : null;
  }
  if (item.type === "phase") {
    const phase = (timeline.phases ?? []).find(
      (entry) => entry.id === item.phaseId,
    );
    const sceneId =
      phase?.sceneId ??
      ctx.findSceneIdAtTime(ctx.state.currentTemplate, phase?.start ?? 0);
    return phase
      ? {
          end: phase.start + phase.duration,
          sceneId,
          selector: `.phase-block[data-phase-id="${ctx.cssEscape(phase.id)}"]`,
          start: phase.start,
        }
      : null;
  }
  if (item.type === "keyframe") {
    const refsToFrame = ctx.getSelectedKeyframeRefs();
    const keyframes = refsToFrame
      .map((ref) => {
        const track = (timeline.tracks ?? []).find(
          (entry) => entry.id === ref.trackId,
        );
        const keyframe = track?.keyframes.find(
          (entry) => entry.id === ref.keyframeId,
        );
        return track && keyframe ? { keyframe, track } : null;
      })
      .filter(Boolean);
    if (keyframes.length === 0) {
      return null;
    }
    const start = Math.min(...keyframes.map((entry) => entry.keyframe.time));
    const end = Math.max(...keyframes.map((entry) => entry.keyframe.time));
    const primary = keyframes[keyframes.length - 1];
    return {
      end,
      sceneId:
        ctx.getKeyframeOwnershipSceneId(
          timeline,
          primary.track,
          primary.keyframe,
        ) ??
        ctx.findSceneIdAtTime(ctx.state.currentTemplate, primary.keyframe.time),
      selector: `.keyframe-point[data-track-id="${ctx.cssEscape(primary.track.id)}"][data-keyframe-id="${ctx.cssEscape(primary.keyframe.id)}"]`,
      start,
    };
  }
  if (item.type === "track") {
    const track = (timeline.tracks ?? []).find(
      (entry) => entry.id === item.trackId,
    );
    const times = (track?.keyframes ?? [])
      .map((keyframe) => Number(keyframe.time))
      .filter(Number.isFinite);
    if (!track || times.length === 0) {
      return null;
    }
    const start = Math.min(...times);
    const end = Math.max(...times);
    return {
      end,
      sceneId:
        track.sceneId ??
        ctx.findSceneIdAtTime(ctx.state.currentTemplate, start),
      selector: `.timeline-lane[data-track-id="${ctx.cssEscape(track.id)}"]`,
      start,
    };
  }
  return { end: template.duration, sceneId: null, selector: null, start: 0 };
}
function frameTimelineRange(ctx: ViewerAppContext, start, end, duration) {
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
function isTimeInsideRange(ctx: ViewerAppContext, time, start, end) {
  return time >= start - 0.0001 && time <= end + 0.0001;
}
function isRangeInsideScene(ctx: ViewerAppContext, start, duration, scene) {
  if (!scene) {
    return false;
  }
  return (
    start >= scene.start - ctx.deps.TIMING_BOUNDARY_TOLERANCE &&
    start + duration <=
      scene.start + scene.duration + ctx.deps.TIMING_BOUNDARY_TOLERANCE
  );
}
function isPhaseSceneBoundaryInvalid(ctx: ViewerAppContext, template, phase) {
  if (!phase?.sceneId) {
    return false;
  }
  const scene = ctx.findTemplateScene(template, phase.sceneId);
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
  template,
  track,
  keyframe,
) {
  const time = Number(keyframe?.time);
  if (
    !Number.isFinite(time) ||
    time < 0 ||
    time > Number(template?.duration || 0)
  ) {
    return true;
  }
  const phase = ctx.findTemplatePhase(
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
  const scene = ctx.findTemplateScene(template, sceneId);
  return Boolean(
    scene &&
    !ctx.isTimeInsideBoundaryRange(
      time,
      scene.start,
      scene.start + scene.duration,
    ),
  );
}
function isTimeInsideBoundaryRange(ctx: ViewerAppContext, time, start, end) {
  return (
    time >= start - ctx.deps.TIMING_BOUNDARY_TOLERANCE &&
    time <= end + ctx.deps.TIMING_BOUNDARY_TOLERANCE
  );
}
function isRangeInvalid(ctx: ViewerAppContext, start, duration, totalDuration) {
  return ctx.deps.isRangeInvalidModel(start, duration, totalDuration);
}
function hasInvalidTiming(ctx: ViewerAppContext, template) {
  return ctx.deps.hasInvalidTimingModel(
    template,
    ctx.createEditorValidationOptions(),
  );
}

export function installModelOwnershipOwner(ctx: ViewerAppContext): void {
  ctx.createSelectedKeyframeSegmentRange = (...args: any[]) =>
    (createSelectedKeyframeSegmentRange as any)(ctx, ...args);
  ctx.getSelectedTimelineRange = (...args: any[]) =>
    (getSelectedTimelineRange as any)(ctx, ...args);
  ctx.frameTimelineRange = (...args: any[]) =>
    (frameTimelineRange as any)(ctx, ...args);
  ctx.isTimeInsideRange = (...args: any[]) =>
    (isTimeInsideRange as any)(ctx, ...args);
  ctx.isRangeInsideScene = (...args: any[]) =>
    (isRangeInsideScene as any)(ctx, ...args);
  ctx.isPhaseSceneBoundaryInvalid = (...args: any[]) =>
    (isPhaseSceneBoundaryInvalid as any)(ctx, ...args);
  ctx.isKeyframeTimingInvalid = (...args: any[]) =>
    (isKeyframeTimingInvalid as any)(ctx, ...args);
  ctx.isTimeInsideBoundaryRange = (...args: any[]) =>
    (isTimeInsideBoundaryRange as any)(ctx, ...args);
  ctx.isRangeInvalid = (...args: any[]) =>
    (isRangeInvalid as any)(ctx, ...args);
  ctx.hasInvalidTiming = (...args: any[]) =>
    (hasInvalidTiming as any)(ctx, ...args);
}
