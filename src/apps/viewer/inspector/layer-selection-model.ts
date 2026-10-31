import type { EditorTemplate } from "../templates/model.js";
import type {
  EffectLayer,
  EffectLayerEditorTransformProperty,
} from "../../../sdk/types.js";
import type { InspectorLocalizedNumberField } from "./field-model.js";
type CommonPropertyField =
  | (InspectorLocalizedNumberField<EffectLayerEditorTransformProperty> & {
      transform: true;
      advanced?: boolean;
    })
  | (InspectorLocalizedNumberField & { transform?: false; advanced?: boolean });
import type { ViewerAppContext } from "../app/context.js";
import { resolveCanvasSelectionBounds } from "../canvas/selection-bounds.js";

const COMMON_PROPERTY_FIELDS: readonly CommonPropertyField[] = [
  {
    labelFallback: "Rotation",
    labelKey: "viewer.inspector.fields.rotation",
    max: 360,
    min: -360,
    property: "rotation",
    step: 0.1,
    transform: true,
  },
  {
    labelFallback: "Scale X",
    labelKey: "viewer.inspector.fields.scaleX",
    max: 8,
    min: 0.05,
    property: "scaleX",
    step: 0.01,
    transform: true,
  },
  {
    labelFallback: "Scale Y",
    labelKey: "viewer.inspector.fields.scaleY",
    max: 8,
    min: 0.05,
    property: "scaleY",
    step: 0.01,
    transform: true,
  },
  {
    labelFallback: "Opacity",
    labelKey: "viewer.inspector.fields.opacity",
    max: 1,
    min: 0,
    property: "opacity",
    step: 0.01,
  },
  {
    advanced: true,
    labelFallback: "Blur",
    labelKey: "viewer.inspector.fields.blur",
    max: 40,
    min: 0,
    property: "blur",
    step: 0.1,
  },
];

export function isLayerSelectionInspector(
  ctx: ViewerAppContext,
  template = ctx.getEffectiveTemplate(ctx.state.currentTemplate),
) {
  return Boolean(
    template && ctx.getCanvasSelectionTarget(template)?.kind === "selection",
  );
}

export function createLayerSelectionInspectorModel(
  ctx: ViewerAppContext,
  template: EditorTemplate,
) {
  const target = ctx.getCanvasSelectionTarget(template);
  if (target?.kind !== "selection") {
    return null;
  }
  const time = Number(ctx.refs.timeSlider.value) || 0;
  const resolution = { time, timeline: template.timeline };
  const layers = target.layerIds
    .map((layerId) => template.layers.find((layer) => layer.id === layerId))
    .filter((layer): layer is EffectLayer => layer !== undefined);
  if (layers.length === 0 || layers.length !== target.layerIds.length)
    return null;
  const primaryRoot =
    target.rootLayerIds.length === 1
      ? template.layers.find((layer) => layer.id === target.rootLayerIds[0])
      : null;
  const bounds = resolveCanvasSelectionBounds(
    ctx,
    template,
    target.layerIds,
    resolution,
  );
  const stats = {
    hidden: layers.filter((layer) => layer.visible === false).length,
    inactive: layers.filter(
      (layer) => !ctx.isLayerActiveAtTime(template, layer.id, time),
    ).length,
    locked: layers.filter((layer) => layer.locked === true).length,
    nonSpatial: layers.filter((layer) => !ctx.isLayerCanvasSelectable(layer))
      .length,
  };
  const spatiallyAvailable =
    bounds !== null &&
    bounds.entries.length === layers.length &&
    stats.hidden === 0 &&
    stats.inactive === 0 &&
    stats.locked === 0;
  const frameMoveEditable =
    spatiallyAvailable &&
    layers.every(
      (layer) =>
        ctx.canTransformLayerProperty(layer, "x") &&
        ctx.canTransformLayerProperty(layer, "y"),
    );
  const frameScaleEditable =
    frameMoveEditable &&
    layers.every(
      (layer) =>
        ctx.canTransformLayerProperty(layer, "scaleX") &&
        ctx.canTransformLayerProperty(layer, "scaleY"),
    );
  return {
    bounds: bounds?.box ?? null,
    commonFields: COMMON_PROPERTY_FIELDS.filter((field) =>
      layers.every((layer) =>
        field.transform
          ? ctx.canTransformLayerProperty(layer, field.property)
          : ctx.canEditLayerProperty(layer, field.property),
      ),
    ).map((field) => ({
      ...field,
      label: field.labelKey
        ? ctx.deps.t(field.labelKey, field.labelFallback)
        : field.labelFallback,
      values: layers.map((layer) =>
        ctx.getResolvedLayerProperty(layer, field.property, resolution),
      ),
    })),
    frameMoveEditable,
    frameScaleEditable,
    grouping: ctx.getLayerGroupingState(),
    groupLayer: primaryRoot?.type === "group" ? primaryRoot : null,
    layerIds: target.layerIds,
    layers,
    propertyEditable: stats.inactive === 0 && stats.locked === 0,
    rootLayerIds: target.rootLayerIds,
    stats,
    time,
  };
}

export type LayerSelectionInspectorModel = NonNullable<
  ReturnType<typeof createLayerSelectionInspectorModel>
>;
