import type {
  ValidationTemplate,
  ValidationTrack,
  ValidationTimeline,
  ValidationKeyframe,
  ValidationScene,
  ValidationPhase,
} from "./input.js";
import type { AddValidationIssue } from "./types.js";
type KeyframeIssueArguments = {
  addIssue: AddValidationIssue;
  duration: number;
  phaseLayerOwners: ReadonlyMap<string, ReadonlySet<string>>;
  phasesById: ReadonlyMap<string, ValidationPhase>;
  scenesById: ReadonlyMap<string, ValidationScene>;
  sceneIds: ReadonlySet<string>;
  phaseIds: ReadonlySet<string>;
  template: ValidationTemplate;
  track: ValidationTrack;
};
import { TIMING_BOUNDARY_TOLERANCE } from "../app/constants.js";

export function collectTrackKeyframeIssues(args: KeyframeIssueArguments) {
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
    const time = keyframe.time ?? NaN;
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
    const phaseId = keyframe.phaseId ?? track.phaseId;
    const phase = phaseId ? phasesById.get(phaseId) : undefined;
    if (
      phase &&
      Number.isFinite(time) &&
      !isTimeInsideBoundaryRange(
        time,
        phase.start ?? 0,
        (phase.start ?? 0) + (phase.duration ?? 0),
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
        scene.start ?? 0,
        (scene.start ?? 0) + (scene.duration ?? 0),
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

export function buildPhaseLayerOwners(
  tracks: readonly ValidationTrack[] | undefined,
) {
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

export function getTrackLayerOwnerId(track: ValidationTrack): string | null {
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
    return track.id.split(".")[0] ?? null;
  }
  return null;
}

function getKeyframeOwnershipSceneId(
  timeline: ValidationTimeline | undefined,
  track: ValidationTrack,
  keyframe: ValidationKeyframe,
) {
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

function keyframeTarget(track: ValidationTrack, keyframe: ValidationKeyframe) {
  return {
    keyframeId: keyframe.id ?? null,
    targetId: keyframe.id ?? track.id,
    targetType: "keyframe",
    trackId: track.id,
  };
}

export function isRangeInsideScene(
  start: number,
  duration: number,
  scene: ValidationScene | undefined,
) {
  if (!scene) {
    return false;
  }
  return (
    start >= (scene.start ?? 0) - TIMING_BOUNDARY_TOLERANCE &&
    start + duration <=
      (scene.start ?? 0) + (scene.duration ?? 0) + TIMING_BOUNDARY_TOLERANCE
  );
}

export function isTimeInsideBoundaryRange(
  time: number,
  start: number,
  end: number,
) {
  return (
    time >= start - TIMING_BOUNDARY_TOLERANCE &&
    time <= end + TIMING_BOUNDARY_TOLERANCE
  );
}
