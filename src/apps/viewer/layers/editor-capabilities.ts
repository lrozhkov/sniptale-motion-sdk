import type {
  EffectLayerEditorCanvasMode,
  EffectLayerEditorOperation,
  EffectLayerEditorTransformProperty,
} from "../../../sdk/types.js";

export type LayerEditorCapabilities = {
  canvas: EffectLayerEditorCanvasMode;
  keyframeProperties: readonly string[];
  operations: readonly EffectLayerEditorOperation[];
  properties: readonly string[];
  transform: readonly EffectLayerEditorTransformProperty[];
};

export type LayerCanvasResizeAxis = "x" | "y";
export type LayerCanvasResizeProperty =
  | "height"
  | "scaleX"
  | "scaleY"
  | "width";

const CANVAS_MODES = new Set<EffectLayerEditorCanvasMode>([
  "bounds",
  "fullFrame",
  "none",
]);
const OPERATIONS = new Set<EffectLayerEditorOperation>([
  "delete",
  "duplicate",
  "reorder",
]);
const TRANSFORM_PROPERTIES = new Set<EffectLayerEditorTransformProperty>([
  "anchorX",
  "anchorY",
  "rotation",
  "scaleX",
  "scaleY",
  "x",
  "y",
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
const DEFAULT_TRANSFORM: EffectLayerEditorTransformProperty[] = [
  "x",
  "y",
  "scaleX",
  "scaleY",
  "rotation",
  "anchorX",
  "anchorY",
];
const DEFAULT_KEYFRAME_PROPERTIES = ["opacity", ...DEFAULT_TRANSFORM, "blur"];
const CONTENT_PROPERTIES_BY_TYPE: Record<string, string[]> = {
  audio: ["volume"],
  ellipse: ["fill", "stroke", "strokeWidth", "blendMode", "width", "height"],
  imageAsset: ["blendMode", "width", "height"],
  line: [
    "stroke",
    "strokeWidth",
    "trimStart",
    "trimEnd",
    "blendMode",
    "width",
    "height",
  ],
  path: [
    "stroke",
    "fill",
    "strokeWidth",
    "trimStart",
    "trimEnd",
    "pathClosed",
    "blendMode",
    "width",
    "height",
  ],
  rect: [
    "fill",
    "stroke",
    "strokeWidth",
    "radius",
    "blendMode",
    "width",
    "height",
  ],
  svgAsset: [
    "svgPartMode",
    "partOrder",
    "partReveal",
    "partStagger",
    "partSpread",
    "partBlur",
    "svgPartIds",
    "blendMode",
    "width",
    "height",
  ],
  text: [
    "text",
    "color",
    "fontFamily",
    "fontSize",
    "blendMode",
    "width",
    "height",
  ],
};

export function resolveLayerEditorCapabilities(
  layer: unknown,
): LayerEditorCapabilities {
  const source = isRecord(layer) ? layer : {};
  const type = typeof source.type === "string" ? source.type : "";
  const spatial = SPATIAL_LAYER_TYPES.has(type);
  const editor = isRecord(source.editor) ? source.editor : null;
  const group = type === "group";
  const defaultProperties = group
    ? []
    : spatial
      ? [
          ...(CONTENT_PROPERTIES_BY_TYPE[type] ?? []),
          "opacity",
          ...DEFAULT_TRANSFORM,
          "blur",
        ]
      : type === "audio"
        ? (CONTENT_PROPERTIES_BY_TYPE.audio ?? [])
        : type === "customDraw"
          ? ["opacity"]
          : [];
  const explicitCanvas = editor?.canvas;
  const canvas = group
    ? "none"
    : CANVAS_MODES.has(explicitCanvas as EffectLayerEditorCanvasMode)
      ? (explicitCanvas as EffectLayerEditorCanvasMode)
      : spatial
        ? "bounds"
        : type === "customDraw"
          ? "fullFrame"
          : "none";
  const explicitTransform = readKnownStringList(
    editor?.transform,
    TRANSFORM_PROPERTIES,
  );
  const transform = group
    ? []
    : (explicitTransform ?? (spatial ? DEFAULT_TRANSFORM : []));
  const properties = uniqueStrings(
    readStringList(editor?.properties) ?? defaultProperties,
  );
  const keyframeProperties = group
    ? []
    : uniqueStrings(
        readStringList(editor?.keyframeProperties) ??
          (spatial
            ? DEFAULT_KEYFRAME_PROPERTIES
            : type === "customDraw"
              ? ["opacity"]
              : []),
      ).filter((property) => properties.includes(property));
  const operations = group
    ? (["delete", "duplicate", "reorder"] as EffectLayerEditorOperation[])
    : (readKnownStringList(editor?.operations, OPERATIONS) ?? ["delete"]);
  return {
    canvas,
    keyframeProperties,
    operations,
    properties,
    transform,
  };
}

export function isLayerCanvasSelectable(layer: unknown): boolean {
  return resolveLayerEditorCapabilities(layer).canvas !== "none";
}

export function isRendererManagedCanvasCapabilities(
  capabilities: LayerEditorCapabilities,
): boolean {
  return (
    capabilities.canvas === "fullFrame" && capabilities.transform.length === 0
  );
}

export function canEditLayerProperty(
  layer: unknown,
  property: string,
): boolean {
  return resolveLayerEditorCapabilities(layer).properties.includes(property);
}

export function canKeyframeLayerProperty(
  layer: unknown,
  property: string,
): boolean {
  return resolveLayerEditorCapabilities(layer).keyframeProperties.includes(
    property,
  );
}

export function canTransformLayerProperty(
  layer: unknown,
  property: EffectLayerEditorTransformProperty,
): boolean {
  return resolveLayerEditorCapabilities(layer).transform.includes(property);
}

export function canPerformLayerOperation(
  layer: unknown,
  operation: EffectLayerEditorOperation,
): boolean {
  return resolveLayerEditorCapabilities(layer).operations.includes(operation);
}

export function resolveLayerCanvasResizeProperty(
  capabilities: LayerEditorCapabilities,
  axis: LayerCanvasResizeAxis,
): LayerCanvasResizeProperty | null {
  if (capabilities.canvas !== "bounds") {
    return null;
  }
  if (
    !capabilities.transform.includes("x") ||
    !capabilities.transform.includes("y")
  ) {
    return null;
  }
  const dimensionProperty = axis === "x" ? "width" : "height";
  if (capabilities.properties.includes(dimensionProperty)) {
    return dimensionProperty;
  }
  const scaleProperty = axis === "x" ? "scaleX" : "scaleY";
  return capabilities.transform.includes(scaleProperty) ? scaleProperty : null;
}

function readStringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  );
}

function readKnownStringList<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
): T[] | null {
  const values = readStringList(value);
  return values
    ? values.filter((item): item is T => allowed.has(item as T))
    : null;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export type LayerEditorCapabilityActions = {
  getLayerEditorCapabilities: typeof resolveLayerEditorCapabilities;
  isLayerCanvasSelectable: typeof isLayerCanvasSelectable;
  canEditLayerProperty: typeof canEditLayerProperty;
  canKeyframeLayerProperty: typeof canKeyframeLayerProperty;
  canTransformLayerProperty: typeof canTransformLayerProperty;
  canPerformLayerOperation: typeof canPerformLayerOperation;
};
export function createLayerEditorCapabilityActions(): LayerEditorCapabilityActions {
  return {
    getLayerEditorCapabilities: resolveLayerEditorCapabilities,
    isLayerCanvasSelectable,
    canEditLayerProperty,
    canKeyframeLayerProperty,
    canTransformLayerProperty,
    canPerformLayerOperation,
  };
}
