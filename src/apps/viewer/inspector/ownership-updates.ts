import { bindViewerAction } from "../app/bind-action.js";

import type { TrackOwnershipPatch } from "./ownership-model.js";
import type { ViewerAppContext } from "../app/context.js";

function updateClipOwnership(
  ctx: ViewerAppContext,
  layerId: string,
  sceneId: string | null,
): void {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return;
  }
  const clips = ctx.deps.deepClone(template.clips);
  const clip = clips.find((item) => item.layerId === layerId);
  if (!clip || clip.locked) {
    return;
  }
  ctx.beginEditorCommand({
    payload: { layerId, sceneId },
    type: "updateClipOwnership",
  });
  clip.sceneId = sceneId || null;
  ctx.setEditorOverride({ clips });
  ctx.selectClipBlock(layerId);
  ctx.renderTimelineEditor(ctx.state.currentTemplate);
  void ctx.renderCurrentFrame();
}

function updatePhaseOwnership(
  ctx: ViewerAppContext,
  phaseId: string,
  sceneId: string | null,
): void {
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const phase = timeline.phases.find((item) => item.id === phaseId);
  if (!template || !phase || phase.locked) {
    return;
  }
  ctx.beginEditorCommand({
    payload: { phaseId, sceneId },
    type: "updatePhaseOwnership",
  });
  phase.sceneId = sceneId || null;
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
  );
  ctx.selectPhaseBlock(phaseId);
  ctx.renderTimelineEditor(template);
  void ctx.renderCurrentFrame();
}

function updateTrackOwnership(
  ctx: ViewerAppContext,
  trackId: string,
  patch: TrackOwnershipPatch,
): void {
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const track = timeline.tracks.find((item) => item.id === trackId);
  if (!template || !track) {
    return;
  }
  ctx.beginEditorCommand({
    payload: { trackId, ...patch },
    type: "updateTrackOwnership",
  });
  if (Object.hasOwn(patch, "phaseId")) {
    track.phaseId = patch.phaseId || null;
  }
  if (Object.hasOwn(patch, "sceneId")) {
    track.sceneId = patch.sceneId || null;
  }
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
  );
  ctx.selectTrackLane(trackId);
  ctx.renderTimelineEditor(template);
  void ctx.renderCurrentFrame();
}

export function createOwnershipUpdateActions(
  getContext: () => ViewerAppContext,
) {
  return {
    updateClipOwnership: bindViewerAction(updateClipOwnership, getContext),
    updatePhaseOwnership: bindViewerAction(updatePhaseOwnership, getContext),
    updateTrackOwnership: bindViewerAction(updateTrackOwnership, getContext),
  };
}
