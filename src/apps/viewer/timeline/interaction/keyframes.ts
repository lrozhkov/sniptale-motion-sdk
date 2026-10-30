import type { ViewerAppContext } from "../../app/context.js";
import { getPairedMotionPathKeyframeRef } from "../model/motion-path-mutations.js";

function collectKeyframeParentLinks(
  ctx: ViewerAppContext,
  template,
  trackId,
  keyframeId,
  links,
) {
  const track = template.timeline?.tracks?.find((item) => item.id === trackId);
  const keyframe = track?.keyframes?.find((item) => item.id === keyframeId);
  if (!track || !keyframe) {
    return;
  }
  links.trackIds.add(track.id);
  links.keyframes.add(ctx.keyframeLinkKey(track.id, keyframe.id));
  const layerId = ctx.getTrackLayerId(track);
  if (layerId) {
    links.clipLayerIds.add(layerId);
  }
  if (keyframe.phaseId || track.phaseId) {
    links.phaseIds.add(keyframe.phaseId ?? track.phaseId);
  }
  if (keyframe.sceneId || track.sceneId) {
    links.sceneIds.add(keyframe.sceneId ?? track.sceneId);
  }
}
function findSelectedKeyframe(ctx: ViewerAppContext, timeline) {
  const selected = ctx.getPrimaryKeyframeSelection();
  if (!selected) {
    return null;
  }
  const track = timeline.tracks.find((item) => item.id === selected.trackId);
  const keyframe = track?.keyframes.find(
    (item) => item.id === selected.keyframeId,
  );
  return track && keyframe ? { keyframe, track } : null;
}
function updateSelectedKeyframe(
  ctx: ViewerAppContext,
  patch,
  trackId = ctx.getPrimaryKeyframeSelection()?.trackId,
  keyframeId = ctx.getPrimaryKeyframeSelection()?.keyframeId,
  options: { history?: boolean } = {},
) {
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const track = timeline.tracks.find((item) => item.id === trackId);
  const keyframe = track?.keyframes.find((item) => item.id === keyframeId);
  if (!template || !track || !keyframe) {
    return;
  }
  if (options.history !== false) {
    ctx.beginEditorCommand({
      payload: { keyframeId, patch, trackId },
      type: "updateKeyframe",
    });
  }
  if (typeof patch.time === "number") {
    keyframe.time = ctx.deps.clamp(
      patch.time,
      0,
      ctx.getEffectiveDuration(template),
    );
  }
  if (patch.value !== undefined) {
    keyframe.value = patch.value;
  }
  if (patch.easing) {
    keyframe.easing = patch.easing;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "phaseId")) {
    keyframe.phaseId =
      typeof patch.phaseId === "string" && patch.phaseId ? patch.phaseId : null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "sceneId")) {
    keyframe.sceneId =
      typeof patch.sceneId === "string" && patch.sceneId ? patch.sceneId : null;
  }
  if (patch.handles) {
    keyframe.handles = {
      ...ctx.deps.normalizeHandles(keyframe.handles),
      ...patch.handles,
    };
    keyframe.easing = "bezier";
  }
  const pairedRef = getPairedMotionPathKeyframeRef(
    timeline,
    trackId,
    keyframeId,
  );
  const pairedTrack = pairedRef
    ? timeline.tracks.find((item) => item.id === pairedRef.trackId)
    : null;
  const pairedKeyframe = pairedTrack?.keyframes.find(
    (item) => item.id === pairedRef?.keyframeId,
  );
  if (pairedTrack && pairedKeyframe) {
    if (typeof patch.time === "number") {
      pairedKeyframe.time = keyframe.time;
    }
    if (patch.easing && keyframe.easing !== undefined) {
      pairedKeyframe.easing = keyframe.easing;
    }
    if (patch.handles && keyframe.handles) {
      pairedKeyframe.handles = { ...keyframe.handles };
      pairedKeyframe.easing = "bezier";
    }
    pairedTrack.keyframes.sort((a, b) => a.time - b.time);
  }
  track.keyframes.sort((a, b) => a.time - b.time);
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
  );
  ctx.renderTimelineEditor(template);
  return ctx.renderCurrentFrame();
}
function addKeyframeAtPlayhead(ctx: ViewerAppContext, trackId) {
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const track = timeline.tracks.find((item) => item.id === trackId);
  if (!template || !track) {
    return;
  }
  const duration = ctx.getEffectiveDuration(template);
  const time = ctx.snapTime(
    ctx.deps.clamp(Number(ctx.refs.timeSlider.value) || 0, 0, duration),
  );
  const value = ctx.resolveTrackValueForNewKeyframe(track, time, timeline);
  let keyframe = track.keyframes.find(
    (item) => Math.abs(item.time - time) < 0.0001,
  );
  ctx.beginEditorCommand({
    payload: { keyframeId: keyframe?.id ?? null, time, trackId },
    type: "addTrackKeyframe",
  });
  if (!keyframe) {
    keyframe = {
      easing: "linear",
      handles: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
      id: ctx.createKeyframeId(timeline, track.id, "playhead", time),
      time,
      value,
    };
    ctx.assignKeyframeOwnershipAtTime(keyframe, track, time);
    track.keyframes.push(keyframe);
  } else {
    keyframe.value = value;
    ctx.assignKeyframeOwnershipAtTime(keyframe, track, time);
  }
  track.keyframes.sort((a, b) => a.time - b.time);
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, duration),
  );
  const selected = { keyframeId: keyframe.id, trackId: track.id };
  ctx.setSelectedKeyframes([selected], { render: false });
  ctx.setSidebarGroup("inspect");
  ctx.renderTimelineEditor(template);
  ctx.renderInspector();
  void ctx.renderCurrentFrame();
}
function resolveTrackValueForNewKeyframe(
  ctx: ViewerAppContext,
  track,
  time,
  timeline = ctx.getEffectiveTimeline(ctx.state.currentTemplate),
) {
  const keyframes = Array.isArray(track?.keyframes) ? track.keyframes : [];
  if (keyframes.every((keyframe) => typeof keyframe.value === "number")) {
    const fallback =
      typeof keyframes[0]?.value === "number" ? keyframes[0].value : 0;
    return ctx.resolveNumericTrack(track, time, fallback, timeline);
  }
  const nearest = keyframes
    .slice()
    .sort((a, b) => Math.abs(a.time - time) - Math.abs(b.time - time))[0];
  return ctx.deps.deepClone(nearest?.value ?? 0);
}
function getSelectedKeyframeRefs(ctx: ViewerAppContext) {
  const refs = ctx.state.selectedKeyframes;
  const unique = new Map();
  for (const ref of refs) {
    unique.set(`${ref.trackId}:${ref.keyframeId}`, ref);
  }
  return Array.from(unique.values());
}
export function installInteractionKeyframesOwner(ctx: ViewerAppContext): void {
  ctx.collectKeyframeParentLinks = collectKeyframeParentLinks.bind(
    undefined,
    ctx,
  );
  ctx.findSelectedKeyframe = findSelectedKeyframe.bind(undefined, ctx);
  ctx.updateSelectedKeyframe = updateSelectedKeyframe.bind(undefined, ctx);
  ctx.addKeyframeAtPlayhead = addKeyframeAtPlayhead.bind(undefined, ctx);
  ctx.resolveTrackValueForNewKeyframe = resolveTrackValueForNewKeyframe.bind(
    undefined,
    ctx,
  );
  ctx.getSelectedKeyframeRefs = getSelectedKeyframeRefs.bind(undefined, ctx);
}
