import { normalizeBindingReads } from "../app/binding-reads.js";
import type {
  ValidationTemplate,
  ValidationLayer,
  ValidationClip,
  ValidationTrack,
} from "./input.js";
import type { AddValidationIssue } from "./types.js";
import { getTrackLayerOwnerId } from "./model-helpers.js";

export function collectRendererContractIssues(
  template: ValidationTemplate,
  rendererCoverage: unknown,
  addIssue: AddValidationIssue,
) {
  if (!template || !rendererCoverage) {
    return;
  }
  const reads = normalizeBindingReads(rendererCoverage);
  const controlReads = toStringSet(reads.controls);
  const phaseReads = toStringSet(reads.phases);
  const layerGateReads = toStringSet(reads.layerGateReads);
  const trackReads = toStringSet(reads.tracks);
  for (const control of template.controls ?? []) {
    if (control?.id && !controlReads.has(control.id)) {
      addIssue(
        `Renderer contract violation: control "${control.id}" is not read`,
        {
          category: "Contract",
          messageKey: "rendererControlUnread",
          messageParams: { control: control.id },
          targetId: control.id,
          targetType: "control",
        },
      );
    }
  }
  for (const phase of template.timeline?.phases ?? []) {
    if (phase?.id && !phaseReads.has(phase.id)) {
      addIssue(`Renderer contract violation: phase "${phase.id}" is not read`, {
        category: "Contract",
        messageKey: "rendererPhaseUnread",
        messageParams: { phase: phase.id },
        targetId: phase.id,
        targetType: "phase",
      });
    }
  }
  for (const track of template.timeline?.tracks ?? []) {
    if (track?.id && !trackReads.has(track.id)) {
      addIssue(`Renderer contract violation: track "${track.id}" is not read`, {
        category: "Contract",
        messageKey: "rendererTrackUnread",
        messageParams: { track: track.id },
        targetId: track.id,
        targetType: "track",
        trackId: track.id,
      });
    }
  }
  if (template.kind !== "composition") {
    return;
  }
  const clipsByLayer = new Map(
    (template.clips ?? [])
      .filter((clip) => clip?.layerId)
      .map((clip) => [clip.layerId, clip]),
  );
  const tracksByLayer = new Map<string, ValidationTrack[]>();
  for (const track of template.timeline?.tracks ?? []) {
    const layerId = getTrackLayerOwnerId(track);
    if (!layerId) {
      continue;
    }
    if (!tracksByLayer.has(layerId)) {
      tracksByLayer.set(layerId, []);
    }
    tracksByLayer.get(layerId)?.push(track);
  }
  for (const layer of template.layers ?? []) {
    if (!isVisualContractLayer(layer, clipsByLayer, tracksByLayer)) {
      continue;
    }
    if (!layerGateReads.has(layer.id)) {
      addIssue(
        `Renderer contract violation: visual layer "${layer.id}" is not gated with resolveLayer/isLayerActive`,
        {
          category: "Contract",
          messageKey: "rendererLayerGate",
          messageParams: { layer: layer.id },
          targetId: layer.id,
          targetType: "layer",
        },
      );
    }
  }
  for (const clip of template.clips ?? []) {
    const layer = (template.layers ?? []).find(
      (item) => item?.id === clip?.layerId,
    );
    if (
      clip?.layerId &&
      layer?.type !== "audio" &&
      !layerGateReads.has(clip.layerId)
    ) {
      addIssue(
        `Renderer contract violation: clip for layer "${clip.layerId}" is not gated with resolveLayer/isLayerActive`,
        {
          category: "Contract",
          messageKey: "rendererClipGate",
          messageParams: { layer: clip.layerId },
          targetId: clip.layerId,
          targetType: "clip",
        },
      );
    }
  }
  for (const track of template.timeline?.tracks ?? []) {
    const layerId = getTrackLayerOwnerId(track);
    if (!layerId || !trackReads.has(track.id) || layerGateReads.has(layerId)) {
      continue;
    }
    addIssue(
      `Renderer contract violation: track "${track.id}" is read without gating layer "${layerId}"`,
      {
        category: "Contract",
        messageKey: "rendererTrackGate",
        messageParams: { layer: layerId, track: track.id },
        targetId: track.id,
        targetType: "track",
        trackId: track.id,
      },
    );
  }
}

function toStringSet(value: unknown): Set<string> {
  return new Set(
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [],
  );
}

function isVisualContractLayer(
  layer: ValidationLayer,
  clipsByLayer: ReadonlyMap<string | null | undefined, ValidationClip>,
  tracksByLayer: ReadonlyMap<string, readonly ValidationTrack[]>,
) {
  if (!layer?.id || layer.type === "audio" || layer.type === "group") {
    return false;
  }
  const visualTypes = new Set([
    "customDraw",
    "text",
    "path",
    "rect",
    "ellipse",
    "line",
    "imageAsset",
    "svgAsset",
  ]);
  return (
    (layer.type !== undefined && visualTypes.has(layer.type)) ||
    clipsByLayer.has(layer.id) ||
    (tracksByLayer.get(layer.id)?.length ?? 0) > 0
  );
}
