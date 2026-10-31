import type { ViewerAppContext } from "./context.js";

function findSceneIdAtTime(ctx: ViewerAppContext, template, time) {
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const at = Number(time) || 0;
  return (
    ctx
      .normalizeScenes(
        effectiveTemplate?.scenes ?? [],
        ctx.getEffectiveDuration(template),
      )
      .find(
        (scene) =>
          scene.enabled !== false &&
          at >= scene.start - 0.0001 &&
          at <= scene.start + scene.duration + 0.0001,
      )?.id ?? null
  );
}
function findPhaseIdAtTime(
  ctx: ViewerAppContext,
  template,
  time,
  layerId = null,
) {
  const timeline = ctx.getEffectiveTimeline(template);
  const at = Number(time) || 0;
  return (
    [...(timeline.phases ?? [])]
      .filter(
        (phase) =>
          phase.enabled !== false &&
          at >= Number(phase.start || 0) - 0.0001 &&
          at <=
            Number(phase.start || 0) + Number(phase.duration || 0) + 0.0001 &&
          ctx.isPhaseCompatibleWithLayer(timeline, phase.id, layerId),
      )
      .sort((a, b) => (Number(b.start) || 0) - (Number(a.start) || 0))[0]?.id ??
    null
  );
}
function setAllSceneRowsExpanded(ctx: ViewerAppContext, expanded) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return;
  }
  const scenes = ctx.normalizeScenes(template.scenes ?? [], template.duration);
  ctx.state.expandedSceneIds = expanded
    ? new Set(scenes.map((scene) => scene.id))
    : new Set();
  ctx.renderTimelineEditor(ctx.state.currentTemplate);
}
function isTimeInsideAnyScene(ctx: ViewerAppContext, time, windows) {
  return windows.some(
    (window) => time >= window.start - 0.0001 && time < window.end - 0.0001,
  );
}
function deleteSelectedTimelineItem(ctx: ViewerAppContext) {
  const template = ctx.state.currentTemplate;
  if (!template || !ctx.state.selectedItem) {
    return;
  }
  if (ctx.state.selectedItem.type === "layer") {
    ctx.deleteSelectedLayer();
    return;
  }
  if (ctx.state.selectedItem.type === "clip") {
    ctx.logDiagnostic(
      ctx.deps.t(
        "viewer.timeline.deleteIntervalHint",
        "The layer interval is selected. Select the layer name to delete the layer.",
      ),
      "error",
    );
    return;
  }
  const timeline = ctx.getEffectiveTimeline(template);
  if (ctx.state.selectedItem.type === "keyframe") {
    ctx.deleteSelectedKeyframes();
    return;
  }
  if (ctx.state.selectedItem.type === "phase") {
    const phaseId = ctx.state.selectedItem.phaseId;
    const phase = timeline.phases.find((item) => item.id === phaseId);
    if (!phase || phase.locked) {
      return;
    }
    ctx.commitHistory("delete-phase");
    timeline.phases = timeline.phases.filter((item) => item.id !== phase.id);
    timeline.tracks = timeline.tracks.map((track) => ({
      ...track,
      keyframes: (track.keyframes ?? []).map((keyframe) =>
        keyframe.phaseId === phase.id
          ? { ...keyframe, phaseId: null }
          : keyframe,
      ),
      ...(track.phaseId === phase.id ? { phaseId: null } : {}),
    }));
    ctx.clearTimelineSelection();
    ctx.state.timelineOverrides.set(
      template.id,
      ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
    );
    ctx.renderTimelineEditor(template);
    void ctx.renderCurrentFrame();
    return;
  }
  if (ctx.state.selectedItem.type === "scene") {
    const effectiveTemplate = ctx.getEffectiveTemplate(template);
    if (!effectiveTemplate) return;
    const scenes = ctx.normalizeScenes(
      effectiveTemplate.scenes ?? [],
      ctx.getEffectiveDuration(template),
    );
    const sceneId = ctx.state.selectedItem.sceneId;
    const scene = scenes.find((item) => item.id === sceneId);
    if (!scene || scene.locked || scenes.length <= 1) {
      return;
    }
    ctx.commitHistory("delete-scene");
    const clips = ctx.deps
      .deepClone(effectiveTemplate.clips ?? [])
      .map((clip) =>
        clip.sceneId === scene.id ? { ...clip, sceneId: null } : clip,
      );
    const timeline = ctx.getEffectiveTimeline(template);
    timeline.phases = (timeline.phases ?? []).map((phase) =>
      phase.sceneId === scene.id ? { ...phase, sceneId: null } : phase,
    );
    timeline.tracks = (timeline.tracks ?? []).map((track) => ({
      ...track,
      keyframes: (track.keyframes ?? []).map((keyframe) =>
        keyframe.sceneId === scene.id
          ? { ...keyframe, sceneId: null }
          : keyframe,
      ),
      ...(track.sceneId === scene.id ? { sceneId: null } : {}),
    }));
    ctx.setEditorOverride({
      clips,
      scenes: scenes.filter((item) => item.id !== scene.id),
    });
    ctx.state.timelineOverrides.set(
      template.id,
      ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
    );
    ctx.clearTimelineSelection();
    ctx.renderTimelineEditor(template);
    void ctx.renderCurrentFrame();
  }
}
function timelineDeltaFromPixels(
  ctx: ViewerAppContext,
  deltaX,
  rect,
  template = ctx.state.currentTemplate,
) {
  const duration = ctx.getEffectiveDuration(template);
  const viewport = ctx.deps.calculateTimelineViewport(
    duration,
    ctx.state.timelineZoom,
    ctx.state.timelineOffset,
  );
  return (deltaX / Math.max(1, rect.width)) * viewport.span;
}
function cssEscape(_ctx: ViewerAppContext, value) {
  return window.CSS?.escape
    ? window.CSS.escape(String(value))
    : String(value).replace(/["\\]/g, "\\$&");
}

export function installAppMiscOwner(ctx: ViewerAppContext): void {
  ctx.findSceneIdAtTime = findSceneIdAtTime.bind(undefined, ctx);
  ctx.findPhaseIdAtTime = findPhaseIdAtTime.bind(undefined, ctx);
  ctx.setAllSceneRowsExpanded = setAllSceneRowsExpanded.bind(undefined, ctx);
  ctx.isTimeInsideAnyScene = isTimeInsideAnyScene.bind(undefined, ctx);
  ctx.deleteSelectedTimelineItem = deleteSelectedTimelineItem.bind(
    undefined,
    ctx,
  );
  ctx.timelineDeltaFromPixels = timelineDeltaFromPixels.bind(undefined, ctx);
  ctx.cssEscape = cssEscape.bind(undefined, ctx);
}
