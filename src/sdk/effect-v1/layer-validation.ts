import { formatEffectV1DiagnosticValue } from "./diagnostics.js";
import { hasKnownIdentifier } from "./validation-shared.js";
import { isUnknownArray } from "./validation-shared.js";
import type { EffectV1ValidationErrorReport } from "./diagnostics.js";
import {
  isRecord,
  rejectUnknownKeys,
  requireIdentifier,
  requireString,
} from "./validation-shared.js";

const LAYER_KEYS = new Set([
  "anchorX",
  "anchorY",
  "assetId",
  "baseX",
  "baseY",
  "blendMode",
  "blur",
  "color",
  "editor",
  "fill",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "height",
  "id",
  "locked",
  "name",
  "opacity",
  "parentId",
  "partBlur",
  "partOrder",
  "partReveal",
  "partSpread",
  "partStagger",
  "pathClosed",
  "pathPoints",
  "radius",
  "rotation",
  "scaleX",
  "scaleY",
  "stroke",
  "strokeWidth",
  "svgPartIds",
  "svgPartMode",
  "text",
  "trimEnd",
  "trimStart",
  "type",
  "visible",
  "volume",
  "width",
  "x",
  "y",
]);
const LAYER_NUMBER_KEYS = [
  "anchorX",
  "anchorY",
  "baseX",
  "baseY",
  "blur",
  "fontSize",
  "fontWeight",
  "height",
  "opacity",
  "partBlur",
  "partReveal",
  "partSpread",
  "partStagger",
  "radius",
  "rotation",
  "scaleX",
  "scaleY",
  "strokeWidth",
  "trimEnd",
  "trimStart",
  "volume",
  "width",
  "x",
  "y",
];
const EDITOR_KEYS = new Set([
  "canvas",
  "keyframeProperties",
  "operations",
  "properties",
  "transform",
]);
const LAYER_TYPES = new Set([
  "audio",
  "customDraw",
  "ellipse",
  "group",
  "imageAsset",
  "line",
  "path",
  "rect",
  "svgAsset",
  "text",
]);
const SPATIAL_LAYER_TYPES = new Set([
  "ellipse",
  "imageAsset",
  "line",
  "path",
  "rect",
  "svgAsset",
  "text",
]);

export function validateEffectV1Layers(
  value: unknown,
  assets: Map<string, Record<string, unknown>>,
  report: EffectV1ValidationErrorReport,
): Map<string, Record<string, unknown>> {
  const layers = new Map<string, Record<string, unknown>>();
  if (!isUnknownArray(value)) {
    report.error("LAYERS_TYPE", "$.layers", "Expected a layer array.");
    return layers;
  }
  value.forEach((layer, index) => {
    const path = `$.layers[${index}]`;
    if (!isRecord(layer)) {
      report.error("LAYER_TYPE", path, "Expected a layer object.");
      return;
    }
    rejectUnknownKeys(layer, LAYER_KEYS, path, report);
    if (requireIdentifier(layer.id, `${path}.id`, report)) {
      if (layers.has(layer.id)) {
        report.error(
          "LAYER_ID_DUPLICATE",
          `${path}.id`,
          `Duplicate layer id "${layer.id}".`,
        );
      }
      layers.set(layer.id, layer);
    }
    if (requireString(layer.type, `${path}.type`, report)) {
      if (!LAYER_TYPES.has(layer.type)) {
        report.error(
          "LAYER_KIND",
          `${path}.type`,
          `Unsupported layer type "${layer.type}".`,
          `Use one of: ${[...LAYER_TYPES].join(", ")}.`,
        );
      }
    }
    validateLayerValues(layer, path, report);
    if (
      layer.assetId !== undefined &&
      !hasKnownIdentifier(layer.assetId, assets)
    ) {
      report.error(
        "LAYER_ASSET_UNKNOWN",
        `${path}.assetId`,
        `Unknown asset "${formatEffectV1DiagnosticValue(layer.assetId)}".`,
        "Declare every runtime asset in this document; pack-global fallback is forbidden.",
      );
    }
    validateLayerContract(layer, path, assets, report);
  });
  validateLayerHierarchy(value, layers, report);
  return layers;
}

function validateLayerContract(
  layer: Record<string, unknown>,
  path: string,
  assets: Map<string, Record<string, unknown>>,
  report: EffectV1ValidationErrorReport,
): void {
  const spatial =
    typeof layer.type === "string" && SPATIAL_LAYER_TYPES.has(layer.type);
  for (const field of ["height", "width"]) {
    if (spatial || layer[field] !== undefined) {
      if (
        typeof layer[field] !== "number" ||
        !Number.isFinite(layer[field]) ||
        layer[field] <= 0
      ) {
        report.error(
          "LAYER_SIZE_REQUIRED",
          `${path}.${field}`,
          `Layer requires a positive ${field}.`,
        );
      }
    }
  }
  if (
    typeof layer.type === "string" &&
    ["audio", "imageAsset", "svgAsset"].includes(layer.type)
  ) {
    if (typeof layer.assetId !== "string") {
      report.error(
        "LAYER_ASSET_REQUIRED",
        `${path}.assetId`,
        `Layer "${layer.type}" requires an assetId.`,
      );
      return;
    }
    const asset = assets.get(layer.assetId);
    const expectedKinds =
      layer.type === "audio"
        ? ["audio"]
        : layer.type === "svgAsset"
          ? ["svg"]
          : ["image"];
    if (
      asset &&
      (typeof asset.kind !== "string" || !expectedKinds.includes(asset.kind))
    ) {
      report.error(
        "LAYER_ASSET_KIND",
        `${path}.assetId`,
        `Layer "${layer.type}" cannot use ${formatEffectV1DiagnosticValue(asset.kind)} asset "${layer.assetId}".`,
      );
    }
  }
  if (layer.type === "text" && typeof layer.text !== "string") {
    report.error(
      "LAYER_TEXT_REQUIRED",
      `${path}.text`,
      "Text layer requires string content.",
    );
  }
  if (layer.type === "group") {
    const forbidden = [
      "assetId",
      "editor",
      "height",
      "opacity",
      "rotation",
      "scaleX",
      "scaleY",
      "width",
      "x",
      "y",
    ];
    for (const field of forbidden) {
      if (layer[field] !== undefined) {
        report.error(
          "GROUP_FIELD_FORBIDDEN",
          `${path}.${field}`,
          `Structural groups cannot define "${field}".`,
        );
      }
    }
  }
}

function validateLayerValues(
  layer: Record<string, unknown>,
  path: string,
  report: EffectV1ValidationErrorReport,
): void {
  for (const key of [
    "blendMode",
    "color",
    "fill",
    "fontFamily",
    "name",
    "partOrder",
    "stroke",
    "svgPartMode",
    "text",
  ]) {
    if (layer[key] !== undefined && typeof layer[key] !== "string")
      report.error("LAYER_STRING", `${path}.${key}`, "Expected a string.");
  }
  if (layer.pathPoints !== undefined && !isUnknownArray(layer.pathPoints))
    report.error(
      "LAYER_PATH_POINTS",
      `${path}.pathPoints`,
      "Expected a point array.",
    );
  if (
    layer.svgPartIds !== undefined &&
    (!isUnknownArray(layer.svgPartIds) ||
      layer.svgPartIds.some((id: unknown) => typeof id !== "string"))
  )
    report.error(
      "LAYER_SVG_PART_IDS",
      `${path}.svgPartIds`,
      "Expected a string array.",
    );
  for (const key of LAYER_NUMBER_KEYS) {
    if (
      layer[key] !== undefined &&
      (typeof layer[key] !== "number" || !Number.isFinite(layer[key]))
    ) {
      report.error(
        "LAYER_NUMBER",
        `${path}.${key}`,
        "Expected a finite number.",
      );
    }
  }
  for (const key of ["locked", "pathClosed", "visible"]) {
    if (layer[key] !== undefined && typeof layer[key] !== "boolean") {
      report.error("LAYER_BOOLEAN", `${path}.${key}`, "Expected a boolean.");
    }
  }
  if (layer.editor !== undefined) {
    if (!isRecord(layer.editor)) {
      report.error(
        "LAYER_EDITOR_TYPE",
        `${path}.editor`,
        "Expected an editor capability object.",
      );
    } else {
      rejectUnknownKeys(layer.editor, EDITOR_KEYS, `${path}.editor`, report);
      if (
        layer.editor.canvas !== undefined &&
        (typeof layer.editor.canvas !== "string" ||
          !["bounds", "fullFrame", "none"].includes(layer.editor.canvas))
      )
        report.error(
          "LAYER_EDITOR_CANVAS",
          `${path}.editor.canvas`,
          "Expected bounds, fullFrame, or none.",
        );
      for (const key of [
        "keyframeProperties",
        "operations",
        "properties",
        "transform",
      ]) {
        if (
          layer.editor[key] !== undefined &&
          (!isUnknownArray(layer.editor[key]) ||
            layer.editor[key].some((item: unknown) => typeof item !== "string"))
        ) {
          report.error(
            "LAYER_EDITOR_LIST",
            `${path}.editor.${key}`,
            "Expected a string array.",
          );
        } else if (isUnknownArray(layer.editor[key])) {
          const allowed =
            key === "operations"
              ? ["delete", "duplicate", "reorder"]
              : key === "transform"
                ? [
                    "anchorX",
                    "anchorY",
                    "rotation",
                    "scaleX",
                    "scaleY",
                    "x",
                    "y",
                  ]
                : null;
          if (
            allowed &&
            layer.editor[key].some(
              (item: unknown) =>
                typeof item !== "string" || !allowed.includes(item),
            )
          )
            report.error(
              "LAYER_EDITOR_CAPABILITY",
              `${path}.editor.${key}`,
              "Unsupported editor capability.",
            );
        }
      }
    }
  }
}

function validateLayerHierarchy(
  orderedLayers: unknown[],
  layers: Map<string, Record<string, unknown>>,
  report: EffectV1ValidationErrorReport,
): void {
  orderedLayers.forEach((layer, index) => {
    if (!isRecord(layer) || layer.parentId == null) return;
    const parent = hasKnownIdentifier(layer.parentId, layers)
      ? layers.get(layer.parentId)
      : undefined;
    if (!parent) {
      report.error(
        "LAYER_PARENT_UNKNOWN",
        `$.layers[${index}].parentId`,
        `Unknown parent "${formatEffectV1DiagnosticValue(layer.parentId)}".`,
      );
    } else if (parent.type !== "group") {
      report.error(
        "LAYER_PARENT_NOT_GROUP",
        `$.layers[${index}].parentId`,
        "A layer parent must be a structural group.",
      );
    }
    const visited = new Set<string>();
    let cursor: Record<string, unknown> | undefined = layer;
    let depth = 0;
    while (cursor?.parentId != null) {
      if (typeof cursor.id !== "string" || typeof cursor.parentId !== "string")
        break;
      if (visited.has(cursor.id)) {
        report.error(
          "LAYER_PARENT_CYCLE",
          `$.layers[${index}].parentId`,
          "Layer hierarchy contains a cycle.",
        );
        break;
      }
      visited.add(cursor.id);
      cursor = layers.get(cursor.parentId);
      depth += 1;
      if (depth > 8) {
        report.error(
          "LAYER_DEPTH",
          `$.layers[${index}].parentId`,
          "Layer nesting exceeds eight levels.",
        );
        break;
      }
    }
  });
  for (const [groupId, group] of layers) {
    if (group.type !== "group") continue;
    const indexes = orderedLayers
      .map((layer, index) =>
        isRecord(layer) && isDescendantOf(layer, groupId, layers) ? index : -1,
      )
      .filter((index) => index >= 0);
    const first = indexes[0];
    const last = indexes.at(-1);
    if (
      first !== undefined &&
      last !== undefined &&
      last - first + 1 !== indexes.length
    ) {
      report.error(
        "LAYER_SUBTREE_DISCONTIGUOUS",
        "$.layers",
        `Group "${groupId}" does not form a continuous render-order segment.`,
      );
    }
  }
}

function isDescendantOf(
  layer: Record<string, unknown>,
  groupId: string,
  layers: Map<string, Record<string, unknown>>,
): boolean {
  let cursor: Record<string, unknown> | undefined = layer;
  const visited = new Set<string>();
  while (cursor?.parentId != null) {
    if (typeof cursor.parentId !== "string" || typeof cursor.id !== "string")
      return false;
    if (cursor.parentId === groupId) return true;
    if (visited.has(cursor.id)) return false;
    visited.add(cursor.id);
    cursor = layers.get(cursor.parentId);
  }
  return false;
}
