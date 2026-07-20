import type { ViewerAppContext } from "../../app/context.js";

function isTimelineItemEnabled(ctx: ViewerAppContext, item) {
  return item?.enabled !== false;
}

function toggleTimelineSceneEnabled(ctx: ViewerAppContext, sceneId) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return;
  }
  const scenes = ctx.deps.deepClone(
    ctx.normalizeScenes(template.scenes ?? [], template.duration),
  );
  const scene = scenes.find((item) => item.id === sceneId);
  if (!scene) {
    return;
  }
  ctx.commitHistory(`scene-enabled:${sceneId}`);
  scene.enabled = scene.enabled === false;
  ctx.setEditorOverride({ scenes });
  ctx.renderTimelineEditor(ctx.state.currentTemplate);
  void ctx.renderCurrentFrame();
}

function toggleTimelineClipEnabled(ctx: ViewerAppContext, layerId) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return;
  }
  const clips = ctx.deps.deepClone(template.clips ?? []);
  const clip = clips.find((item) => item.layerId === layerId);
  if (!clip) {
    return;
  }
  ctx.commitHistory(`clip-enabled:${layerId}`);
  clip.enabled = clip.enabled === false;
  ctx.setEditorOverride({ clips });
  ctx.renderTimelineEditor(ctx.state.currentTemplate);
  void ctx.renderCurrentFrame();
}

function toggleTimelinePhaseEnabled(ctx: ViewerAppContext, phaseId) {
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const phase = timeline.phases.find((item) => item.id === phaseId);
  if (!template || !phase) {
    return;
  }
  ctx.commitHistory(`phase-enabled:${phaseId}`);
  phase.enabled = phase.enabled === false;
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
  );
  ctx.renderTimelineEditor(template);
  void ctx.renderCurrentFrame();
}

function toggleTimelineTrackEnabled(ctx: ViewerAppContext, trackId) {
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const track = timeline.tracks.find((item) => item.id === trackId);
  if (!template || !track) {
    return;
  }
  ctx.commitHistory(`track-enabled:${trackId}`);
  track.enabled = track.enabled === false;
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
  );
  ctx.renderTimelineEditor(template);
  void ctx.renderCurrentFrame();
}

function toggleTimelineKeyframeEnabled(
  ctx: ViewerAppContext,
  trackId,
  keyframeId,
) {
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const track = timeline.tracks.find((item) => item.id === trackId);
  const keyframe = track?.keyframes.find((item) => item.id === keyframeId);
  if (!template || !keyframe) {
    return;
  }
  ctx.commitHistory(`keyframe-enabled:${trackId}:${keyframeId}`);
  keyframe.enabled = keyframe.enabled === false;
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
  );
  ctx.renderTimelineEditor(template);
  void ctx.renderCurrentFrame();
}

function appendTimelineEnabledToggle(
  ctx: ViewerAppContext,
  label,
  options: {
    enabled: boolean;
    id: string;
    title: string;
    type: "clip" | "keyframe" | "layer" | "phase" | "scene" | "track";
  },
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "timeline-enabled-toggle icon-button";
  button.dataset.enabledType = options.type;
  button.dataset.enabledId = options.id;
  ctx.setIconButton(button, options.enabled ? "eye" : "eyeOff", options.title);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (options.type === "scene") {
      ctx.toggleTimelineSceneEnabled(options.id);
    } else if (options.type === "layer") {
      ctx.toggleLayerVisibility(options.id);
    } else if (options.type === "clip") {
      ctx.toggleTimelineClipEnabled(options.id);
    } else if (options.type === "phase") {
      ctx.toggleTimelinePhaseEnabled(options.id);
    } else if (options.type === "track") {
      ctx.toggleTimelineTrackEnabled(options.id);
    }
  });
  label.classList.add("has-enabled-toggle");
  label.prepend(button);
}

export function installTimelineEnabledOwner(ctx: ViewerAppContext): void {
  ctx.isTimelineItemEnabled = (...args: any[]) =>
    (isTimelineItemEnabled as any)(ctx, ...args);
  ctx.toggleTimelineSceneEnabled = (...args: any[]) =>
    (toggleTimelineSceneEnabled as any)(ctx, ...args);
  ctx.toggleTimelineClipEnabled = (...args: any[]) =>
    (toggleTimelineClipEnabled as any)(ctx, ...args);
  ctx.toggleTimelinePhaseEnabled = (...args: any[]) =>
    (toggleTimelinePhaseEnabled as any)(ctx, ...args);
  ctx.toggleTimelineTrackEnabled = (...args: any[]) =>
    (toggleTimelineTrackEnabled as any)(ctx, ...args);
  ctx.toggleTimelineKeyframeEnabled = (...args: any[]) =>
    (toggleTimelineKeyframeEnabled as any)(ctx, ...args);
  ctx.appendTimelineEnabledToggle = (...args: any[]) =>
    (appendTimelineEnabledToggle as any)(ctx, ...args);
}
