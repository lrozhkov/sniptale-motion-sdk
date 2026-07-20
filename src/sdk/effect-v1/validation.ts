import {
  createEffectV1Diagnostics,
  finishEffectV1Validation,
} from "./diagnostics.js";
import { resolveEffectV1InputContract } from "./input-contract.js";
import { validateEffectV1Assets } from "./asset-validation.js";
import { validateEffectV1Layers } from "./layer-validation.js";
import {
  rejectEffectV1ExecutableFields,
  validateEffectV1Program,
} from "./program-validation.js";
import {
  validateEffectV1Clips,
  validateEffectV1Controls,
  validateEffectV1Scenes,
} from "./scene-validation.js";
import { validateEffectV1Timeline } from "./timeline-validation.js";
import {
  EFFECT_V1_KINDS,
  EFFECT_V1_SCHEMA,
  type EffectV1Document,
  type EffectV1ValidationResult,
} from "./types.js";
import {
  isRecord,
  rejectUnknownKeys,
  requireIdentifier,
  requirePositiveNumber,
  requireString,
  validateLocaleText,
} from "./validation-shared.js";

const ROOT_KEYS = new Set([
  "assets",
  "clips",
  "controls",
  "description",
  "duration",
  "id",
  "kind",
  "label",
  "layers",
  "presets",
  "program",
  "scenes",
  "schemaVersion",
  "timeline",
]);
const IMPLICIT_COMMAND_TRACK_PROPERTIES = new Set(["opacity", "x", "y"]);
const RESOLVED_LAYER_TRACK_PROPERTIES = new Set([
  "anchorX",
  "anchorY",
  "blur",
  "opacity",
  "rotation",
  "scaleX",
  "scaleY",
  "x",
  "y",
]);
const STYLED_COMMAND_OPS = new Set([
  "clip",
  "compositePass",
  "fillRect",
  "group",
  "image",
  "path",
  "polyline",
  "sampledPath",
  "shape",
  "svgParts",
  "text",
]);

export function parseEffectV1Source(source: string): EffectV1ValidationResult {
  if (typeof source !== "string" || source.trim() === "") {
    return finishEffectV1Validation([
      {
        code: "INPUT_EMPTY",
        message: "Effect document is empty.",
        path: "$",
        severity: "error",
        suggestion: "Provide one UTF-8 JSON object.",
      },
    ]);
  }
  try {
    return validateEffectV1Document(JSON.parse(source));
  } catch (error) {
    return finishEffectV1Validation([
      {
        code: "JSON_INVALID",
        message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        path: "$",
        severity: "error",
        suggestion:
          "Use strict JSON: double-quoted keys and strings, without comments or trailing commas.",
      },
    ]);
  }
}

export function validateEffectV1Document(
  input: unknown,
): EffectV1ValidationResult {
  return validateEffectV1DocumentInternal(input);
}

function validateEffectV1DocumentInternal(
  input: unknown,
): EffectV1ValidationResult {
  const report = createEffectV1Diagnostics();
  if (!isRecord(input)) {
    report.error("ROOT_TYPE", "$", "Expected one JSON object.");
    return finishEffectV1Validation(report.diagnostics);
  }
  rejectUnknownKeys(input, ROOT_KEYS, "$", report);
  rejectEffectV1ExecutableFields(input, "$", report);
  validateEffectV1Identity(input, report);

  const assets = validateEffectV1Assets(input.assets, report);
  const layers = validateEffectV1Layers(input.layers, assets, report);
  const scenes = validateEffectV1Scenes(
    input.scenes,
    Number(input.duration),
    report,
  );
  validateEffectV1Clips(
    input.clips,
    layers,
    scenes,
    Number(input.duration),
    report,
  );
  const controlIds = validateEffectV1Controls(input.controls, report);
  const trackIds = validateEffectV1Timeline(
    input.timeline,
    layers,
    scenes,
    Number(input.duration),
    report,
  );
  const runtimeInputs = EFFECT_V1_KINDS.includes(input.kind as any)
    ? new Set(resolveEffectV1InputContract(input.kind as any).required)
    : new Set<string>();
  validateEffectV1Program(
    input.program,
    assets,
    runtimeInputs,
    { controlIds, layerIds: new Set(layers.keys()), trackIds },
    report,
  );
  validateControlClosure(input, controlIds, report);
  validateTrackClosure(input, trackIds, report);
  validatePhaseClosure(input, report);
  validateAssetClosure(input, assets, report);
  return finishEffectV1Validation(
    report.diagnostics,
    input as unknown as EffectV1Document,
  );
}

function validatePhaseClosure(input: Record<string, any>, report: any): void {
  const used = new Set<string>();
  const tracks = Array.isArray(input.timeline?.tracks)
    ? input.timeline.tracks
    : [];
  for (const track of tracks) {
    if (typeof track?.phaseId === "string") used.add(track.phaseId);
    for (const keyframe of Array.isArray(track?.keyframes)
      ? track.keyframes
      : []) {
      if (typeof keyframe?.phaseId === "string") used.add(keyframe.phaseId);
    }
  }
  const phases = Array.isArray(input.timeline?.phases)
    ? input.timeline.phases
    : [];
  phases.forEach((phase: any, index: number) => {
    if (typeof phase?.id !== "string" || used.has(phase.id)) return;
    report.error(
      "PHASE_UNUSED",
      `$.timeline.phases[${index}]`,
      `Phase "${phase.id}" never gates a track or keyframe.`,
      `Reference "${phase.id}" from track.phaseId or keyframe.phaseId, or remove the phase.`,
    );
  });
}

function validateTrackClosure(
  input: Record<string, any>,
  tracks: Set<string>,
  report: any,
): void {
  const used = new Set<string>();
  collectReadIds(input.program, "tracks.", used);
  const layerReads = new Set<string>();
  collectReadIds(input.program, "layers.", layerReads);
  const commandLayerIds = new Set<string>();
  collectStyledCommandLayerIds(input.program?.commands, commandLayerIds);
  const trackList = Array.isArray(input.timeline?.tracks)
    ? input.timeline.tracks
    : [];
  for (const track of trackList) {
    const trackId = typeof track?.id === "string" ? track.id : null;
    const layerId = track?.layerId ?? track?.target;
    const property = track?.property;
    if (
      !trackId ||
      typeof layerId !== "string" ||
      typeof property !== "string" ||
      trackId !== `${layerId}.${property}` ||
      !RESOLVED_LAYER_TRACK_PROPERTIES.has(property)
    ) {
      continue;
    }
    if (
      layerReads.has(trackId) ||
      (commandLayerIds.has(layerId) &&
        IMPLICIT_COMMAND_TRACK_PROPERTIES.has(property))
    ) {
      used.add(trackId);
    }
  }
  for (const trackId of tracks) {
    if (used.has(trackId)) continue;
    const index = trackList.findIndex((track: any) => track?.id === trackId);
    report.error(
      "TRACK_UNUSED",
      index >= 0 ? `$.timeline.tracks[${index}]` : "$.timeline.tracks",
      `Track "${trackId}" is editable but never read by the graph.`,
      `Read "tracks.${trackId}" from a command or definition, or remove the track.`,
    );
  }
}

function collectStyledCommandLayerIds(
  value: unknown,
  result: Set<string>,
): void {
  if (!Array.isArray(value)) return;
  for (const command of value) {
    if (!isRecord(command)) continue;
    if (
      STYLED_COMMAND_OPS.has(String(command.op)) &&
      typeof command.layerId === "string"
    ) {
      result.add(command.layerId);
    }
    collectStyledCommandLayerIds(command.commands, result);
  }
}

function validateControlClosure(
  input: Record<string, any>,
  controls: Set<string>,
  report: any,
): void {
  const used = new Set<string>();
  collectReadIds(input.program, "controls.", used);
  for (const controlId of controls) {
    if (used.has(controlId)) continue;
    const index = Array.isArray(input.controls)
      ? input.controls.findIndex((control: any) => control?.id === controlId)
      : -1;
    report.error(
      "CONTROL_UNUSED",
      index >= 0 ? `$.controls[${index}]` : "$.controls",
      `Control "${controlId}" is exposed but never read by the graph.`,
      `Read "controls.${controlId}" from a command or definition, or remove the control.`,
    );
  }
}

function collectReadIds(
  value: unknown,
  prefix: string,
  result: Set<string>,
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectReadIds(item, prefix, result));
    return;
  }
  if (!isRecord(value)) return;
  if (
    value.op === "read" &&
    typeof value.path === "string" &&
    value.path.startsWith(prefix)
  ) {
    result.add(value.path.slice(prefix.length));
  }
  Object.values(value).forEach((item) => collectReadIds(item, prefix, result));
}

function validateAssetClosure(
  input: Record<string, any>,
  assets: Map<string, any>,
  report: any,
): void {
  const used = new Set<string>();
  for (const layer of Array.isArray(input.layers) ? input.layers : []) {
    if (typeof layer?.assetId === "string") used.add(layer.assetId);
  }
  collectCommandAssetIds(input.program?.commands, used);
  for (const [assetId] of assets) {
    if (!used.has(assetId)) {
      const index = Array.isArray(input.assets)
        ? input.assets.findIndex((asset: any) => asset?.id === assetId)
        : -1;
      report.error(
        "ASSET_UNUSED",
        index >= 0 ? `$.assets[${index}]` : "$.assets",
        `Asset "${assetId}" is declared but never used.`,
        "Reference it from a layer or graph command, or remove it from the bundle.",
      );
    }
  }
}

function collectCommandAssetIds(value: unknown, used: Set<string>): void {
  if (!Array.isArray(value)) return;
  for (const command of value) {
    if (!command || typeof command !== "object") continue;
    const record = command as Record<string, unknown>;
    if (typeof record.assetId === "string") used.add(record.assetId);
    collectCommandAssetIds(record.commands, used);
  }
}

function validateEffectV1Identity(
  input: Record<string, any>,
  report: any,
): void {
  requireString(input.schemaVersion, "$.schemaVersion", report);
  if (input.schemaVersion !== EFFECT_V1_SCHEMA) {
    report.error(
      "SCHEMA_UNSUPPORTED",
      "$.schemaVersion",
      `Expected ${EFFECT_V1_SCHEMA}.`,
      `Set schemaVersion to "${EFFECT_V1_SCHEMA}"; v3 executable files are not supported.`,
    );
  }
  requireIdentifier(input.id, "$.id", report);
  if (!EFFECT_V1_KINDS.includes(input.kind as any)) {
    report.error(
      "KIND_UNKNOWN",
      "$.kind",
      "Expected standalone, targetEffect, or transition.",
      "Choose the kind from the runtime media the effect consumes.",
    );
  }
  requirePositiveNumber(input.duration, "$.duration", report);
  validateLocaleText(input.label, "$.label", true, report);
  if (input.description !== undefined) {
    validateLocaleText(input.description, "$.description", false, report);
  }
  if (input.presets !== undefined && !Array.isArray(input.presets)) {
    report.error("PRESETS_TYPE", "$.presets", "Expected a preset array.");
  }
}
