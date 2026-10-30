import type { ViewerAppContext } from "../../app/context.js";

function createPhaseMovePlan(
  ctx: ViewerAppContext,
  effectiveTemplate,
  phaseIds,
  totalDuration,
  includeLinkedKeys = true,
) {
  const timeline = ctx.deps.deepClone(
    effectiveTemplate?.timeline ?? { phases: [], tracks: [] },
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
  const keyframeItems = [];
  const bounds = [];
  const addBound = (start, end = start) => bounds.push({ end, start });
  const seenKeyframes = new Set();
  const keyframedPhaseIds = new Set();
  if (includeLinkedKeys) {
    (timeline.tracks ?? []).forEach((track) => {
      (track.keyframes ?? []).forEach((keyframe) => {
        const key = `${track.id}:${keyframe.id}`;
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
  template,
  plan,
  deltaTime,
  options: any = {},
) {
  if (!template || !plan) {
    return;
  }
  const totalDuration = ctx.getEffectiveDuration(template);
  const delta =
    ctx.snapDuration(Math.abs(deltaTime)) * Math.sign(deltaTime || 0);
  plan.phaseItems.forEach((item) => {
    item.phase.start = ctx.snapTime(
      ctx.deps.clamp(item.start + delta, 0, totalDuration - item.duration),
    );
  });
  plan.keyframeItems.forEach((item) => {
    item.keyframe.time = ctx.snapTime(
      ctx.deps.clamp(item.time + delta, 0, totalDuration),
    );
  });
  (plan.timeline.tracks ?? []).forEach((track) => {
    track.keyframes = [...(track.keyframes ?? [])].sort(
      (a, b) => a.time - b.time,
    );
  });
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

function createSceneMovePlan(
  ctx: ViewerAppContext,
  effectiveTemplate,
  sceneIds,
  totalDuration,
  includeLinkedKeys = true,
) {
  const scenes = ctx.normalizeScenes(
    effectiveTemplate.scenes ?? [],
    totalDuration,
  );
  const selected = new Set(sceneIds);
  const sceneItems = scenes
    .filter((scene) => selected.has(scene.id) && !scene.locked)
    .map((scene) => ({
      duration: scene.duration,
      scene,
      sceneId: scene.id,
      start: scene.start,
    }));
  const windows = sceneItems.map((item) => ({
    end: item.start + item.duration,
    sceneId: item.sceneId,
    start: item.start,
  }));
  const clips = ctx.deps.deepClone(effectiveTemplate.clips ?? []);
  const timeline = ctx.deps.deepClone(
    effectiveTemplate.timeline ?? { phases: [], tracks: [] },
  );
  const globalLayerIds = ctx.getGlobalTimelineLayerIds(
    effectiveTemplate,
    scenes,
  );
  const clipItems = [];
  const phaseItems = [];
  const keyframeItems = [];
  const bounds = [];
  const addBound = (start, end = start) => {
    bounds.push({ end, start });
  };
  sceneItems.forEach((item) =>
    addBound(item.start, item.start + item.duration),
  );
  if (includeLinkedKeys) {
    clips.forEach((clip) => {
      if (
        !globalLayerIds.has(clip.layerId) &&
        ctx.timingBelongsToSelectedScene(clip, clip.start, windows, selected)
      ) {
        clipItems.push({
          clip,
          duration: Number(clip.duration) || 0.05,
          layerId: clip.layerId,
          start: Number(clip.start) || 0,
        });
        addBound(
          Number(clip.start) || 0,
          (Number(clip.start) || 0) + (Number(clip.duration) || 0),
        );
      }
    });
    (timeline.phases ?? []).forEach((phase) => {
      const phaseLayerIds = ctx.getPhaseTrackLayerIds(timeline, phase.id);
      if (
        ![...phaseLayerIds].some((layerId) => globalLayerIds.has(layerId)) &&
        ctx.timingBelongsToSelectedScene(
          phase,
          phase.start,
          windows,
          selected,
        ) &&
        !phase.locked
      ) {
        phaseItems.push({
          duration: Number(phase.duration) || 0.05,
          phase,
          phaseId: phase.id,
          start: Number(phase.start) || 0,
        });
        addBound(
          Number(phase.start) || 0,
          (Number(phase.start) || 0) + (Number(phase.duration) || 0),
        );
      }
    });
    const seenKeyframes = new Set();
    (timeline.tracks ?? []).forEach((track) => {
      if (globalLayerIds.has(ctx.getTrackLayerId(track))) {
        return;
      }
      (track.keyframes ?? []).forEach((keyframe) => {
        const time = Number(keyframe.time) || 0;
        const key = `${track.id}:${keyframe.id}`;
        if (
          !seenKeyframes.has(key) &&
          ctx.timingBelongsToSelectedScene(
            keyframe,
            time,
            windows,
            selected,
            track.sceneId,
          )
        ) {
          seenKeyframes.add(key);
          keyframeItems.push({
            keyframe,
            keyframeId: keyframe.id,
            time,
            track,
            trackId: track.id,
          });
          addBound(time);
        }
      });
    });
  }
  const minStart = bounds.length
    ? Math.min(...bounds.map((item) => item.start))
    : 0;
  const maxEnd = bounds.length
    ? Math.max(...bounds.map((item) => item.end))
    : totalDuration;
  return {
    clipItems,
    clips,
    keyframeItems,
    maxDelta: totalDuration - maxEnd,
    minDelta: -minStart,
    phaseItems,
    sceneItems,
    scenes,
    timeline,
  };
}

function applySceneMovePlan(
  ctx: ViewerAppContext,
  template,
  plan,
  deltaTime,
  options: any = {},
) {
  if (!template || !plan) {
    return;
  }
  const totalDuration = ctx.getEffectiveDuration(template);
  const delta =
    ctx.snapDuration(Math.abs(deltaTime)) * Math.sign(deltaTime || 0);
  plan.sceneItems.forEach((item) => {
    item.scene.start = ctx.snapTime(
      ctx.deps.clamp(item.start + delta, 0, totalDuration - item.duration),
    );
  });
  plan.clipItems.forEach((item) => {
    item.clip.start = ctx.snapTime(
      ctx.deps.clamp(item.start + delta, 0, totalDuration - item.duration),
    );
  });
  plan.phaseItems.forEach((item) => {
    item.phase.start = ctx.snapTime(
      ctx.deps.clamp(item.start + delta, 0, totalDuration - item.duration),
    );
  });
  plan.keyframeItems.forEach((item) => {
    item.keyframe.time = ctx.snapTime(
      ctx.deps.clamp(item.time + delta, 0, totalDuration),
    );
  });
  (plan.timeline.tracks ?? []).forEach((track) => {
    track.keyframes = [...(track.keyframes ?? [])].sort(
      (a, b) => a.time - b.time,
    );
  });
  ctx.setEditorOverride({ clips: plan.clips, scenes: plan.scenes });
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

export function installModelPhaseSceneMovePlansOwner(
  ctx: ViewerAppContext,
): void {
  ctx.createPhaseMovePlan = createPhaseMovePlan.bind(undefined, ctx);
  ctx.applyPhaseMovePlan = applyPhaseMovePlan.bind(undefined, ctx);
  ctx.createSceneMovePlan = createSceneMovePlan.bind(undefined, ctx);
  ctx.applySceneMovePlan = applySceneMovePlan.bind(undefined, ctx);
}
