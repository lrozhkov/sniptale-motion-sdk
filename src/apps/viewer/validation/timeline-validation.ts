import type { ValidationTemplate, ValidationScene } from "./input.js";
import type { AddValidationIssue } from "./types.js";
type TrackIssueArguments = {
  addIssue: AddValidationIssue;
  duration: number;
  layerIds: ReadonlySet<string>;
  phaseIds: ReadonlySet<string>;
  sceneIds: ReadonlySet<string>;
  scenesById: ReadonlyMap<string, ValidationScene>;
  template: ValidationTemplate;
};
import {
  buildPhaseLayerOwners,
  collectTrackKeyframeIssues,
  isRangeInsideScene,
} from "./model-helpers.js";
import { isRangeInvalid } from "./ranges.js";

export function collectSceneIssues(
  template: ValidationTemplate,
  duration: number,
  addIssue: AddValidationIssue,
) {
  const sceneIds = new Set<string>();
  const scenesById = new Map<string, ValidationScene>();
  for (const scene of template.scenes ?? []) {
    if (!scene?.id) {
      addIssue("Scene is missing id", {
        messageKey: "sceneMissingId",
        targetType: "scene",
      });
      continue;
    }
    if (sceneIds.has(scene.id)) {
      addIssue(`Duplicate scene id "${scene.id}"`, {
        messageKey: "duplicateSceneId",
        messageParams: { id: scene.id },
        targetId: scene.id,
        targetType: "scene",
      });
    }
    sceneIds.add(scene.id);
    scenesById.set(scene.id, scene);
    if (isRangeInvalid(scene.start ?? 0, scene.duration ?? 0, duration)) {
      addIssue(`Scene "${scene.id}" is outside effect duration`, {
        messageKey: "sceneOutsideEffect",
        messageParams: { scene: scene.id },
        targetId: scene.id,
        targetType: "scene",
      });
    }
  }
  return { sceneIds, scenesById };
}

export function collectClipSceneIssues(
  template: ValidationTemplate,
  sceneIds: ReadonlySet<string>,
  scenesById: ReadonlyMap<string, ValidationScene>,
  addIssue: AddValidationIssue,
) {
  for (const clip of template.clips ?? []) {
    if (clip.sceneId && !sceneIds.has(clip.sceneId)) {
      addIssue(
        `Clip "${clip.layerId ?? "(missing)"}" references missing scene "${clip.sceneId}"`,
        {
          messageKey: "clipMissingScene",
          messageParams: {
            clip: clip.layerId ?? "(missing)",
            scene: clip.sceneId,
          },
          targetId: clip.layerId ?? null,
          targetType: "clip",
        },
      );
    } else if (
      clip.sceneId &&
      !isRangeInsideScene(
        clip.start ?? 0,
        clip.duration ?? 0,
        scenesById.get(clip.sceneId),
      )
    ) {
      addIssue(
        `Clip "${clip.layerId ?? "(missing)"}" is outside scene "${clip.sceneId}"`,
        {
          messageKey: "clipOutsideScene",
          messageParams: {
            clip: clip.layerId ?? "(missing)",
            scene: clip.sceneId,
          },
          targetId: clip.layerId ?? null,
          targetType: "clip",
        },
      );
    }
  }
}

export function collectPhaseIssues(
  template: ValidationTemplate,
  duration: number,
  sceneIds: ReadonlySet<string>,
  scenesById: ReadonlyMap<string, ValidationScene>,
  addIssue: AddValidationIssue,
) {
  const phaseIds = new Set<string>();
  for (const phase of template.timeline?.phases ?? []) {
    if (!phase?.id) {
      addIssue("Phase is missing id", {
        messageKey: "phaseMissingId",
        targetType: "phase",
      });
      continue;
    }
    if (phaseIds.has(phase.id)) {
      addIssue(`Duplicate phase id "${phase.id}"`, {
        messageKey: "duplicatePhaseId",
        messageParams: { id: phase.id },
        targetId: phase.id,
        targetType: "phase",
      });
    }
    phaseIds.add(phase.id);
    if (isRangeInvalid(phase.start ?? 0, phase.duration ?? 0, duration)) {
      addIssue(`Phase "${phase.id}" is outside effect duration`, {
        messageKey: "phaseOutsideEffect",
        messageParams: { phase: phase.id },
        targetId: phase.id,
        targetType: "phase",
      });
    }
    if (phase.sceneId && !sceneIds.has(phase.sceneId)) {
      addIssue(
        `Phase "${phase.id}" references missing scene "${phase.sceneId}"`,
        {
          messageKey: "phaseMissingScene",
          messageParams: { phase: phase.id, scene: phase.sceneId },
          targetId: phase.id,
          targetType: "phase",
        },
      );
    } else if (
      phase.sceneId &&
      !isRangeInsideScene(
        phase.start ?? 0,
        phase.duration ?? 0,
        scenesById.get(phase.sceneId),
      )
    ) {
      addIssue(`Phase "${phase.id}" is outside scene "${phase.sceneId}"`, {
        messageKey: "phaseOutsideScene",
        messageParams: { phase: phase.id, scene: phase.sceneId },
        targetId: phase.id,
        targetType: "phase",
      });
    }
  }
  return phaseIds;
}

export function collectTrackIssues(args: TrackIssueArguments) {
  const {
    addIssue,
    duration,
    layerIds,
    phaseIds,
    sceneIds,
    scenesById,
    template,
  } = args;
  const trackIds = new Set<string>();
  const phasesById = new Map(
    (template.timeline?.phases ?? [])
      .filter((phase) => phase?.id)
      .map((phase) => [phase.id, phase]),
  );
  const phaseLayerOwners = buildPhaseLayerOwners(template.timeline?.tracks);
  for (const track of template.timeline?.tracks ?? []) {
    if (!track?.id) {
      addIssue("Track is missing id", {
        messageKey: "trackMissingId",
        targetType: "track",
      });
      continue;
    }
    if (trackIds.has(track.id)) {
      addIssue(`Duplicate track id "${track.id}"`, {
        messageKey: "duplicateTrackId",
        messageParams: { id: track.id },
        targetId: track.id,
        targetType: "track",
      });
    }
    trackIds.add(track.id);
    const targetLayer =
      track.layerId || (track.target === "scene" ? null : track.target);
    if (targetLayer && !layerIds.has(targetLayer)) {
      addIssue(
        `Track "${track.id}" references missing layer "${targetLayer}"`,
        {
          messageKey: "trackMissingLayer",
          messageParams: { layer: targetLayer, track: track.id },
          targetId: track.id,
          targetType: "track",
        },
      );
    }
    if (track.phaseId && !phaseIds.has(track.phaseId)) {
      addIssue(
        `Track "${track.id}" references missing phase "${track.phaseId}"`,
        {
          messageKey: "trackMissingPhase",
          messageParams: { phase: track.phaseId, track: track.id },
          targetId: track.id,
          targetType: "track",
        },
      );
    }
    if (track.sceneId && !sceneIds.has(track.sceneId)) {
      addIssue(
        `Track "${track.id}" references missing scene "${track.sceneId}"`,
        {
          messageKey: "trackMissingScene",
          messageParams: { scene: track.sceneId, track: track.id },
          targetId: track.id,
          targetType: "track",
        },
      );
    }
    collectTrackKeyframeIssues({
      addIssue,
      duration,
      phasesById,
      phaseLayerOwners,
      scenesById,
      sceneIds,
      phaseIds,
      template,
      track,
    });
  }
}
