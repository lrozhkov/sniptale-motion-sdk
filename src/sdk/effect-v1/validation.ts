import { validateEffectV1ControlGroupIcons } from "./control-group-icons-validation.js";
import { validateEffectV1ControlGroups } from "./control-groups-validation.js";
import { formatEffectV1DiagnosticValue } from "./diagnostics.js";
import { isUnknownArray } from "./validation-shared.js";
import type { EffectV1ValidationErrorReport } from "./diagnostics.js";
import { validateEffectV1EditorRegion } from "./editor-region-validation.js";
import { validateEffectV1ControlPresets } from "./control-presets-validation.js";
import {
  createEffectV1Diagnostics,
  finishEffectV1Validation,
} from "./diagnostics.js";
import {
  isEffectV1Kind,
  resolveEffectV1InputContract,
} from "./input-contract.js";
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
import { validateEffectV1ObjectLayout } from "./object-layout-validation.js";
import {
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
  "controlGroups",
  "assets",
  "clips",
  "controls",
  "editorRegion",
  "controlPresets",
  "defaultControlPresetId",
  "description",
  "duration",
  "id",
  "kind",
  "label",
  "layers",
  "objectLayout",
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

export type EffectV1ValidationOptions = {
  /** Retained replay preserves legacy presentation metadata; structural/security errors remain errors. */
  presentationPolicy?: "authoring" | "retained";
};

export function parseEffectV1Source(
  source: string,
  options: EffectV1ValidationOptions = {},
): EffectV1ValidationResult {
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
    return validateEffectV1Document(JSON.parse(source), options);
  } catch (error) {
    return finishEffectV1Validation([
      {
        code: "JSON_INVALID",
        message: `Invalid JSON: ${error instanceof Error ? error.message : formatEffectV1DiagnosticValue(error)}`,
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
  options: EffectV1ValidationOptions = {},
): EffectV1ValidationResult {
  return validateEffectV1DocumentInternal(input, options);
}

function validateEffectV1DocumentInternal(
  input: unknown,
  options: EffectV1ValidationOptions = {},
): EffectV1ValidationResult {
  const report = createEffectV1Diagnostics();
  if (!isRecord(input)) {
    report.error("ROOT_TYPE", "$", "Expected one JSON object.");
    return finishEffectV1Validation(report.diagnostics);
  }
  rejectUnknownKeys(input, ROOT_KEYS, "$", report);
  rejectEffectV1ExecutableFields(input, "$", report);
  validateEffectV1Identity(input, report);
  validateEffectV1ObjectLayout(
    input.objectLayout,
    input.kind,
    report,
    input.controls,
  );

  const duration = typeof input.duration === "number" ? input.duration : NaN;
  const assets = validateEffectV1Assets(input.assets, report);
  const layers = validateEffectV1Layers(input.layers, assets, report);
  const scenes = validateEffectV1Scenes(input.scenes, duration, report);
  validateEffectV1Clips(input.clips, layers, scenes, duration, report);
  validateEffectV1ControlGroups(input.controlGroups, report);
  const controlIds = validateEffectV1Controls(
    input.controls,
    report,
    input.controlGroups,
  );
  const iconReport: EffectV1ValidationErrorReport =
    options.presentationPolicy === "retained"
      ? {
          error: (code, path, message, suggestion) =>
            report.warning(code, path, message, suggestion),
        }
      : report;
  validateEffectV1ControlGroupIcons(
    input.controlGroups,
    input.controls,
    iconReport,
  );
  validateEffectV1ControlPresets(input, report);
  validateEffectV1EditorRegion(input, report);
  const trackIds = validateEffectV1Timeline(
    input.timeline,
    layers,
    scenes,
    duration,
    report,
  );
  const runtimeInputs = isEffectV1Kind(input.kind)
    ? new Set(resolveEffectV1InputContract(input.kind).required)
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

function validatePhaseClosure(
  input: Record<string, unknown>,
  report: EffectV1ValidationErrorReport,
): void {
  const used = new Set<string>();
  const timeline = isRecord(input.timeline) ? input.timeline : null;
  const tracks = isUnknownArray(timeline?.tracks) ? timeline.tracks : [];
  for (const track of tracks) {
    if (!isRecord(track)) continue;
    if (typeof track.phaseId === "string") used.add(track.phaseId);
    for (const keyframe of isUnknownArray(track?.keyframes)
      ? track.keyframes
      : []) {
      if (isRecord(keyframe) && typeof keyframe.phaseId === "string")
        used.add(keyframe.phaseId);
    }
  }
  const phases = isUnknownArray(timeline?.phases) ? timeline.phases : [];
  phases.forEach((phase, index) => {
    if (!isRecord(phase) || typeof phase.id !== "string" || used.has(phase.id))
      return;
    report.error(
      "PHASE_UNUSED",
      `$.timeline.phases[${index}]`,
      `Phase "${phase.id}" never gates a track or keyframe.`,
      `Reference "${phase.id}" from track.phaseId or keyframe.phaseId, or remove the phase.`,
    );
  });
}

function validateTrackClosure(
  input: Record<string, unknown>,
  tracks: Set<string>,
  report: EffectV1ValidationErrorReport,
): void {
  const used = new Set<string>();
  collectReadIds(input.program, "tracks.", used);
  const layerReads = new Set<string>();
  collectReadIds(input.program, "layers.", layerReads);
  const commandLayerIds = new Set<string>();
  collectStyledCommandLayerIds(
    isRecord(input.program) ? input.program.commands : undefined,
    commandLayerIds,
  );
  const timeline = isRecord(input.timeline) ? input.timeline : null;
  const trackList = isUnknownArray(timeline?.tracks) ? timeline.tracks : [];
  for (const track of trackList) {
    if (!isRecord(track)) continue;
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
    const index = trackList.findIndex(
      (track) => isRecord(track) && track.id === trackId,
    );
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
  if (!isUnknownArray(value)) return;
  for (const command of value) {
    if (!isRecord(command)) continue;
    if (
      typeof command.op === "string" &&
      STYLED_COMMAND_OPS.has(command.op) &&
      typeof command.layerId === "string"
    ) {
      result.add(command.layerId);
    }
    collectStyledCommandLayerIds(command.commands, result);
  }
}

function validateControlClosure(
  input: Record<string, unknown>,
  controls: Set<string>,
  report: EffectV1ValidationErrorReport,
): void {
  const used = new Set<string>();
  collectReadIds(input.program, "controls.", used);
  for (const controlId of controls) {
    if (used.has(controlId)) continue;
    const index = isUnknownArray(input.controls)
      ? input.controls.findIndex(
          (control) => isRecord(control) && control.id === controlId,
        )
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
  if (isUnknownArray(value)) {
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
  input: Record<string, unknown>,
  assets: Map<string, Record<string, unknown>>,
  report: EffectV1ValidationErrorReport,
): void {
  const used = new Set<string>();
  for (const layer of isUnknownArray(input.layers) ? input.layers : []) {
    if (isRecord(layer) && typeof layer.assetId === "string")
      used.add(layer.assetId);
  }
  collectCommandAssetIds(
    isRecord(input.program) ? input.program.commands : undefined,
    used,
  );
  for (const [assetId] of assets) {
    if (!used.has(assetId)) {
      const index = isUnknownArray(input.assets)
        ? input.assets.findIndex(
            (asset) => isRecord(asset) && asset.id === assetId,
          )
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
  if (!isUnknownArray(value)) return;
  for (const command of value) {
    if (!isRecord(command)) continue;
    const record = command;
    if (typeof record.assetId === "string") used.add(record.assetId);
    collectCommandAssetIds(record.commands, used);
  }
}

function validateEffectV1Identity(
  input: Record<string, unknown>,
  report: EffectV1ValidationErrorReport,
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
  if (!isEffectV1Kind(input.kind)) {
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
  if (input.presets !== undefined && !isUnknownArray(input.presets)) {
    report.error("PRESETS_TYPE", "$.presets", "Expected a preset array.");
  }
}
