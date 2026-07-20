import { TIMING_BOUNDARY_TOLERANCE } from "../app/constants.js";

export function collectTrackKeyframeIssues(args) {
  const {
    addIssue,
    duration,
    phaseLayerOwners,
    phasesById,
    scenesById,
    sceneIds,
    phaseIds,
    template,
    track,
  } = args;
  const trackLayerOwner = getTrackLayerOwnerId(track) ?? "__scene__";
  for (const keyframe of track.keyframes ?? []) {
    const time = Number(keyframe.time);
    if (!Number.isFinite(time) || time < 0 || time > duration) {
      addIssue(
        `Keyframe "${keyframe.id ?? "(missing)"}" in "${track.id}" is outside effect duration`,
        {
          keyframeId: keyframe.id ?? null,
          messageKey: "keyframeOutsideEffect",
          messageParams: {
            keyframe: keyframe.id ?? "(missing)",
            track: track.id,
          },
          targetId: keyframe.id ?? track.id,
          targetType: "keyframe",
          trackId: track.id,
        },
      );
    }
    if (keyframe.sceneId && !sceneIds.has(keyframe.sceneId)) {
      addIssue(
        `Keyframe "${keyframe.id ?? "(missing)"}" in "${track.id}" references missing scene "${keyframe.sceneId}"`,
        {
          ...keyframeTarget(track, keyframe),
          messageKey: "keyframeMissingScene",
          messageParams: {
            keyframe: keyframe.id ?? "(missing)",
            scene: keyframe.sceneId,
            track: track.id,
          },
        },
      );
    }
    if (keyframe.phaseId && !phaseIds.has(keyframe.phaseId)) {
      addIssue(
        `Keyframe "${keyframe.id ?? "(missing)"}" in "${track.id}" references missing phase "${keyframe.phaseId}"`,
        {
          ...keyframeTarget(track, keyframe),
          messageKey: "keyframeMissingPhase",
          messageParams: {
            keyframe: keyframe.id ?? "(missing)",
            phase: keyframe.phaseId,
            track: track.id,
          },
        },
      );
    }
    if (keyframe.phaseId && keyframe.phaseId !== track.phaseId) {
      const phaseOwners = phaseLayerOwners?.get(keyframe.phaseId);
      if (phaseOwners?.size === 1 && !phaseOwners.has(trackLayerOwner)) {
        addIssue(
          `Keyframe "${keyframe.id ?? "(missing)"}" in "${track.id}" references phase "${keyframe.phaseId}" owned by another layer`,
          {
            ...keyframeTarget(track, keyframe),
            messageKey: "keyframeForeignPhase",
            messageParams: {
              keyframe: keyframe.id ?? "(missing)",
              phase: keyframe.phaseId,
              track: track.id,
            },
          },
        );
      }
    }
    const phase: any = phasesById.get(keyframe.phaseId ?? track.phaseId);
    if (
      phase &&
      Number.isFinite(time) &&
      !isTimeInsideBoundaryRange(
        time,
        Number(phase.start) || 0,
        (Number(phase.start) || 0) + (Number(phase.duration) || 0),
      )
    ) {
      addIssue(
        `Keyframe "${keyframe.id ?? "(missing)"}" in "${track.id}" is outside phase "${phase.id}"`,
        {
          ...keyframeTarget(track, keyframe),
          messageKey: "keyframeOutsidePhase",
          messageParams: {
            keyframe: keyframe.id ?? "(missing)",
            phase: phase.id,
            track: track.id,
          },
        },
      );
    }
    const sceneId = getKeyframeOwnershipSceneId(
      template.timeline,
      track,
      keyframe,
    );
    const scene = sceneId ? scenesById.get(sceneId) : null;
    if (
      scene &&
      Number.isFinite(time) &&
      !isTimeInsideBoundaryRange(
        time,
        Number(scene.start) || 0,
        (Number(scene.start) || 0) + (Number(scene.duration) || 0),
      )
    ) {
      addIssue(
        `Keyframe "${keyframe.id ?? "(missing)"}" in "${track.id}" is outside scene "${scene.id}"`,
        {
          ...keyframeTarget(track, keyframe),
          messageKey: "keyframeOutsideScene",
          messageParams: {
            keyframe: keyframe.id ?? "(missing)",
            scene: scene.id,
            track: track.id,
          },
        },
      );
    }
  }
}

export function buildPhaseLayerOwners(tracks) {
  const phaseLayerOwners = new Map<string, Set<string>>();
  for (const track of tracks ?? []) {
    const trackOwner = getTrackLayerOwnerId(track) ?? "__scene__";
    if (track?.phaseId) {
      if (!phaseLayerOwners.has(track.phaseId)) {
        phaseLayerOwners.set(track.phaseId, new Set());
      }
      phaseLayerOwners.get(track.phaseId)?.add(trackOwner);
    }
    for (const keyframe of track?.keyframes ?? []) {
      if (!keyframe?.phaseId) {
        continue;
      }
      if (!phaseLayerOwners.has(keyframe.phaseId)) {
        phaseLayerOwners.set(keyframe.phaseId, new Set());
      }
      phaseLayerOwners.get(keyframe.phaseId)?.add(trackOwner);
    }
  }
  return phaseLayerOwners;
}

export function getTrackLayerOwnerId(track) {
  if (typeof track?.layerId === "string") {
    return track.layerId;
  }
  if (track?.target === "scene") {
    return null;
  }
  if (typeof track?.target === "string" && track.target !== "scene") {
    return track.target;
  }
  if (typeof track?.id === "string" && track.id.includes(".")) {
    return track.id.split(".")[0];
  }
  return null;
}

function getKeyframeOwnershipSceneId(timeline, track, keyframe) {
  if (typeof keyframe?.sceneId === "string") {
    return keyframe.sceneId;
  }
  if (typeof track?.sceneId === "string") {
    return track.sceneId;
  }
  const phaseId =
    typeof keyframe?.phaseId === "string" ? keyframe.phaseId : track?.phaseId;
  const phase = (timeline?.phases ?? []).find((item) => item.id === phaseId);
  return typeof phase?.sceneId === "string" ? phase.sceneId : null;
}

function keyframeTarget(track, keyframe) {
  return {
    keyframeId: keyframe.id ?? null,
    targetId: keyframe.id ?? track.id,
    targetType: "keyframe",
    trackId: track.id,
  };
}

export function isRangeInsideScene(start, duration, scene) {
  if (!scene) {
    return false;
  }
  return (
    start >= scene.start - TIMING_BOUNDARY_TOLERANCE &&
    start + duration <= scene.start + scene.duration + TIMING_BOUNDARY_TOLERANCE
  );
}

export function isTimeInsideBoundaryRange(time, start, end) {
  return (
    time >= start - TIMING_BOUNDARY_TOLERANCE &&
    time <= end + TIMING_BOUNDARY_TOLERANCE
  );
}
