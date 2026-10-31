import type { TimelineEnabledToggleOptions } from "./timing-contract.js";
import { bindViewerAction } from "../../app/bind-action.js";
import type { ViewerAppContext } from "../../app/context.js";

function isTimelineItemEnabled(
  _ctx: ViewerAppContext,
  item: { enabled?: boolean } | null | undefined,
): boolean {
  return item?.enabled !== false;
}

function toggleTimelineSceneEnabled(
  ctx: ViewerAppContext,
  sceneId: string,
): void {
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

function toggleTimelineClipEnabled(
  ctx: ViewerAppContext,
  layerId: string,
): void {
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

function toggleTimelinePhaseEnabled(
  ctx: ViewerAppContext,
  phaseId: string,
): void {
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

function toggleTimelineTrackEnabled(
  ctx: ViewerAppContext,
  trackId: string,
): void {
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
  trackId: string,
  keyframeId: string,
): void {
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
  label: HTMLElement,
  options: TimelineEnabledToggleOptions,
): void {
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

export function createTimelineEnabledActions(
  getContext: () => ViewerAppContext,
) {
  return {
    isTimelineItemEnabled: bindViewerAction(isTimelineItemEnabled, getContext),
    toggleTimelineSceneEnabled: bindViewerAction(
      toggleTimelineSceneEnabled,
      getContext,
    ),
    toggleTimelineClipEnabled: bindViewerAction(
      toggleTimelineClipEnabled,
      getContext,
    ),
    toggleTimelinePhaseEnabled: bindViewerAction(
      toggleTimelinePhaseEnabled,
      getContext,
    ),
    toggleTimelineTrackEnabled: bindViewerAction(
      toggleTimelineTrackEnabled,
      getContext,
    ),
    toggleTimelineKeyframeEnabled: bindViewerAction(
      toggleTimelineKeyframeEnabled,
      getContext,
    ),
    appendTimelineEnabledToggle: bindViewerAction(
      appendTimelineEnabledToggle,
      getContext,
    ),
  };
}
