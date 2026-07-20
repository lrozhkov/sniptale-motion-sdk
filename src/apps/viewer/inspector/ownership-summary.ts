import type { ViewerAppContext } from "../app/context.js";

function getSceneOwnershipSummary(ctx: ViewerAppContext, template, scene) {
  const plan = ctx.createSceneMovePlan(template, [scene.id], template.duration);
  const t = (key, fallback) => ctx.deps.t(key, fallback);
  return {
    note: t(
      "viewer.inspector.ownershipDetails.sceneNote",
      "Dragging the body moves linked clips, phases, and keyframes. Edge handles only change scene boundaries.",
    ),
    rows: [
      [
        t("viewer.inspector.ownershipDetails.bodyMoves", "Body moves"),
        t(
          "viewer.inspector.ownershipDetails.sceneMoveCount",
          "{clips} clips · {phases} phases · {keys} keys",
        )
          .replace("{clips}", String(plan.clipItems.length))
          .replace("{phases}", String(plan.phaseItems.length))
          .replace("{keys}", String(plan.keyframeItems.length)),
      ],
      [
        t("viewer.inspector.ownershipDetails.selectionKey", "Selection key"),
        `sceneId:${scene.id}`,
      ],
      [
        t("viewer.inspector.ownershipDetails.separate", "Separate"),
        t("viewer.inspector.ownershipDetails.sceneTrim", "Scene edge handles"),
      ],
    ],
  };
}

function getClipOwnershipSummary(ctx: ViewerAppContext, template, clip) {
  const plan = ctx.createClipMovePlan(
    template,
    [clip.layerId],
    template.duration,
  );
  const t = (key, fallback) => ctx.deps.t(key, fallback);
  return {
    note: t(
      "viewer.inspector.ownershipDetails.clipNote",
      "Dragging the body moves the clip, compatible layer keyframes, and their phases. Edge handles only change in/out.",
    ),
    rows: [
      [
        t("viewer.inspector.ownershipDetails.bodyMoves", "Body moves"),
        t(
          "viewer.inspector.ownershipDetails.clipMoveCount",
          "{keys} layer keys · {phases} phases",
        )
          .replace("{keys}", String(plan.keyframeItems.length))
          .replace("{phases}", String(plan.phaseItems.length)),
      ],
      [
        t("viewer.inspector.ownershipDetails.layerKey", "Layer key"),
        clip.layerId,
      ],
      [
        t("viewer.inspector.ownershipDetails.separate", "Separate"),
        t(
          "viewer.inspector.ownershipDetails.clipTrim",
          "Clip start/end handles",
        ),
      ],
    ],
  };
}

function getPhaseOwnershipSummary(ctx: ViewerAppContext, template, phase) {
  const plan = ctx.createPhaseMovePlan(template, [phase.id], template.duration);
  const t = (key, fallback) => ctx.deps.t(key, fallback);
  return {
    note: t(
      "viewer.inspector.ownershipDetails.phaseNote",
      "Dragging the body moves the phase and its keyframes. Edge handles only resize the phase.",
    ),
    rows: [
      [
        t("viewer.inspector.ownershipDetails.bodyMoves", "Body moves"),
        t(
          "viewer.inspector.ownershipDetails.phaseMoveCount",
          "{keys} phase keys",
        ).replace("{keys}", String(plan.keyframeItems.length)),
      ],
      [
        t("viewer.inspector.ownershipDetails.selectionKey", "Selection key"),
        `phaseId:${phase.id}`,
      ],
      [
        t("viewer.inspector.ownershipDetails.separate", "Separate"),
        t(
          "viewer.inspector.ownershipDetails.phaseTrim",
          "Phase start/end handles",
        ),
      ],
    ],
  };
}

function getTrackOwnershipSummary(ctx: ViewerAppContext, template, track) {
  const layerId = ctx.getTrackLayerId(track);
  const clip = layerId
    ? (template.clips ?? []).find((item) => item.layerId === layerId)
    : null;
  const keyCount = track.keyframes?.length ?? 0;
  const t = (key, fallback) => ctx.deps.t(key, fallback);
  return {
    note: t(
      "viewer.inspector.ownershipDetails.trackNote",
      "Dragging a track moves every keyframe on this property. Individual keys can override phase or scene links.",
    ),
    rows: [
      [
        t("viewer.inspector.ownershipDetails.trackMoves", "Track moves"),
        t("viewer.inspector.ownershipDetails.keyCount", "{keys} keys").replace(
          "{keys}",
          String(keyCount),
        ),
      ],
      [
        t("viewer.inspector.ownershipDetails.layerClip", "Layer clip"),
        clip?.layerId ?? t("viewer.inspector.values.none", "None"),
      ],
      [
        t("viewer.inspector.ownershipDetails.defaultPhase", "Default phase"),
        track.phaseId ?? t("viewer.inspector.values.none", "None"),
      ],
      [
        t("viewer.inspector.ownershipDetails.defaultScene", "Default scene"),
        track.sceneId ??
          t("viewer.inspector.ownershipDetails.timeWindow", "Time window"),
      ],
    ],
  };
}

function getKeyframeOwnershipSummary(
  ctx: ViewerAppContext,
  template,
  track,
  keyframe,
) {
  const layerId = ctx.getTrackLayerId(track);
  const clip = layerId
    ? (template.clips ?? []).find((item) => item.layerId === layerId)
    : null;
  const inferredSceneId = ctx
    .normalizeScenes(template.scenes ?? [], template.duration)
    .find((scene) =>
      ctx.isTimeInsideRange(
        Number(keyframe.time) || 0,
        scene.start,
        scene.start + scene.duration,
      ),
    )?.id;
  const t = (key, fallback) => ctx.deps.t(key, fallback);
  return {
    note: t(
      "viewer.inspector.ownershipDetails.keyframeNote",
      "Dragging a keyframe moves this key or the current multi-selection. Parent blocks show what can move it as a group.",
    ),
    rows: [
      [
        t("viewer.inspector.ownershipDetails.layerClip", "Layer clip"),
        clip?.layerId ?? t("viewer.inspector.values.none", "None"),
      ],
      [
        t("viewer.inspector.fields.phase", "Phase"),
        keyframe.phaseId ??
          track.phaseId ??
          t("viewer.inspector.values.none", "None"),
      ],
      [
        t("viewer.inspector.fields.scene", "Scene"),
        keyframe.sceneId ??
          track.sceneId ??
          inferredSceneId ??
          t("viewer.inspector.values.none", "None"),
      ],
    ],
  };
}

function updateClipOwnership(ctx: ViewerAppContext, layerId, sceneId) {
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

function updatePhaseOwnership(ctx: ViewerAppContext, phaseId, sceneId) {
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

function updateTrackOwnership(ctx: ViewerAppContext, trackId, patch) {
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

export function installInspectorOwnershipSummaryOwner(
  ctx: ViewerAppContext,
): void {
  ctx.getSceneOwnershipSummary = (...args: any[]) =>
    (getSceneOwnershipSummary as any)(ctx, ...args);
  ctx.getClipOwnershipSummary = (...args: any[]) =>
    (getClipOwnershipSummary as any)(ctx, ...args);
  ctx.getPhaseOwnershipSummary = (...args: any[]) =>
    (getPhaseOwnershipSummary as any)(ctx, ...args);
  ctx.getTrackOwnershipSummary = (...args: any[]) =>
    (getTrackOwnershipSummary as any)(ctx, ...args);
  ctx.getKeyframeOwnershipSummary = (...args: any[]) =>
    (getKeyframeOwnershipSummary as any)(ctx, ...args);
  ctx.updateClipOwnership = (...args: any[]) =>
    (updateClipOwnership as any)(ctx, ...args);
  ctx.updatePhaseOwnership = (...args: any[]) =>
    (updatePhaseOwnership as any)(ctx, ...args);
  ctx.updateTrackOwnership = (...args: any[]) =>
    (updateTrackOwnership as any)(ctx, ...args);
}
