import { bindViewerAction } from "../app/bind-action.js";
import type {
  EffectLayer,
  EffectLayerEditorTransformProperty,
} from "../../../sdk/types.js";
import type { InspectorPropertyActions } from "./contract.js";
import type {
  InspectorLocalizedNumberField,
  InspectorNumberField,
} from "./field-model.js";
import type { ViewerAppContext } from "../app/context.js";

const SIZE_PROPERTIES = new Set(["height", "width"]);
const ADVANCED_CONTENT_PROPERTIES = new Set(["blendMode"]);
const SVG_PART_PROPERTIES = new Set([
  "partBlur",
  "partOrder",
  "partReveal",
  "partSpread",
  "partStagger",
  "svgPartIds",
  "svgPartMode",
]);

const APPEARANCE_FIELDS: readonly InspectorLocalizedNumberField[] = [
  {
    labelFallback: "Opacity",
    labelKey: "viewer.inspector.fields.opacity",
    max: 1,
    min: 0,
    property: "opacity",
    step: 0.01,
  },
];

const TRANSFORM_FIELDS: readonly InspectorLocalizedNumberField<EffectLayerEditorTransformProperty>[] =
  [
    { labelFallback: "X", max: 4000, min: -4000, property: "x", step: 0.1 },
    { labelFallback: "Y", max: 4000, min: -4000, property: "y", step: 0.1 },
    {
      labelFallback: "Scale X",
      labelKey: "viewer.inspector.fields.scaleX",
      max: 8,
      min: 0.05,
      property: "scaleX",
      step: 0.01,
    },
    {
      labelFallback: "Scale Y",
      labelKey: "viewer.inspector.fields.scaleY",
      max: 8,
      min: 0.05,
      property: "scaleY",
      step: 0.01,
    },
    {
      labelFallback: "Rotation",
      labelKey: "viewer.inspector.fields.rotation",
      max: 360,
      min: -360,
      property: "rotation",
      step: 0.1,
    },
  ];

const ADVANCED_TRANSFORM_FIELDS: readonly InspectorLocalizedNumberField[] = [
  {
    labelFallback: "Anchor X",
    labelKey: "viewer.inspector.fields.anchorX",
    max: 0.5,
    min: -0.5,
    property: "anchorX",
    step: 0.01,
  },
  {
    labelFallback: "Anchor Y",
    labelKey: "viewer.inspector.fields.anchorY",
    max: 0.5,
    min: -0.5,
    property: "anchorY",
    step: 0.01,
  },
  {
    labelFallback: "Blur",
    labelKey: "viewer.inspector.fields.blur",
    max: 40,
    min: 0,
    property: "blur",
    step: 0.1,
  },
];

export function partitionLayerContentFields<T extends { property: string }>(
  fields: readonly T[],
) {
  return {
    advanced: fields.filter((field) =>
      ADVANCED_CONTENT_PROPERTIES.has(field.property),
    ),
    primary: fields.filter(
      (field) =>
        !SIZE_PROPERTIES.has(field.property) &&
        !ADVANCED_CONTENT_PROPERTIES.has(field.property) &&
        !SVG_PART_PROPERTIES.has(field.property),
    ),
    size: fields.filter((field) => SIZE_PROPERTIES.has(field.property)),
    svgParts: fields.filter((field) => SVG_PART_PROPERTIES.has(field.property)),
  };
}

function appendLayerPropertiesInspector(
  ctx: ViewerAppContext,
  layer: EffectLayer,
) {
  const capabilities = ctx.getLayerEditorCapabilities(layer);
  const content = partitionLayerContentFields(
    ctx
      .getLayerContentFields(layer)
      .filter((field) => ctx.canEditLayerProperty(layer, field.property))
      .map((field) => ({
        ...field,
        label: ctx.deps.t(
          `viewer.inspector.layerFields.${field.property}`,
          field.label,
        ),
      })),
  );

  if (capabilities.transform.length === 0) {
    ctx.appendInspectorNode(createNonSpatialLayerNote(ctx, layer));
  }

  if (layer.type === "audio") {
    const audio = createPropertyGroup({
      id: "audio",
      label: ctx.deps.t("viewer.inspector.audio", "Audio"),
    });
    for (const field of content.primary) {
      ctx.appendInspectorLayerField(layer, field, audio.body);
    }
    if (audio.body.childElementCount > 0) {
      ctx.appendInspectorNode(audio.root);
    }
    return;
  }

  const transform = createPropertyGroup({
    id: "transform",
    label: ctx.deps.t("viewer.inspector.transform", "Transform"),
    paired: true,
  });
  for (const field of localizeFields(ctx, TRANSFORM_FIELDS).filter((field) =>
    ctx.canTransformLayerProperty(layer, field.property),
  )) {
    ctx.appendInspectorNumberField(layer, field, transform.body);
  }
  if (transform.body.childElementCount > 0) {
    ctx.appendInspectorNode(transform.root);
  }

  if (content.size.length > 0) {
    const size = createPropertyGroup({
      id: "size",
      label: ctx.deps.t("viewer.inspector.fields.size", "Size"),
      paired: true,
    });
    for (const field of content.size) {
      ctx.appendInspectorLayerField(layer, field, size.body);
    }
    ctx.appendInspectorNode(size.root);
  }

  const appearance = createPropertyGroup({
    id: "appearance",
    label: ctx.deps.t(
      "viewer.inspector.contentAppearance",
      "Content & appearance",
    ),
    paired: ["ellipse", "line", "path", "rect"].includes(layer.type),
  });
  for (const field of content.primary) {
    ctx.appendInspectorLayerField(layer, field, appearance.body);
  }
  for (const field of localizeFields(ctx, APPEARANCE_FIELDS).filter((field) =>
    ctx.canEditLayerProperty(layer, field.property),
  )) {
    ctx.appendInspectorNumberField(layer, field, appearance.body);
  }
  if (appearance.body.childElementCount > 0) {
    ctx.appendInspectorNode(appearance.root);
  }
  if (content.svgParts.length > 0) {
    const svgParts = createPropertyGroup({
      id: "svg-animation",
      label: ctx.deps.t(
        "viewer.inspector.svgPartAnimation",
        "SVG part animation",
      ),
    });
    const partMode =
      typeof layer.svgPartMode === "string" ? layer.svgPartMode : "none";
    const partAnimationEnabled = partMode !== "none";
    for (const field of content.svgParts) {
      if (field.property === "svgPartMode" || partAnimationEnabled) {
        ctx.appendInspectorLayerField(layer, field, svgParts.body);
      }
    }
    if (partAnimationEnabled && ctx.canEditLayerProperty(layer, "svgPartIds")) {
      ctx.appendSvgPartPicker(layer, svgParts.body);
    }
    if (svgParts.body.childElementCount > 0) {
      ctx.appendInspectorNode(svgParts.root);
    }
  }

  const advanced = createAdvancedPropertyGroup(ctx);
  for (const field of content.advanced) {
    ctx.appendInspectorLayerField(layer, field, advanced.body);
  }
  for (const field of localizeFields(ctx, ADVANCED_TRANSFORM_FIELDS).filter(
    (field) => ctx.canEditLayerProperty(layer, field.property),
  )) {
    ctx.appendInspectorNumberField(layer, field, advanced.body);
  }
  if (advanced.body.childElementCount > 0) {
    ctx.appendInspectorNode(advanced.root);
  }
}

function createNonSpatialLayerNote(ctx: ViewerAppContext, layer: EffectLayer) {
  const note = document.createElement("p");
  note.className = "inspector-capability-note";
  note.textContent =
    layer.type === "audio"
      ? ctx.deps.t(
          "viewer.inspector.audioCanvasNote",
          "Audio is edited on the timeline and has no canvas geometry.",
        )
      : ctx.deps.t(
          "viewer.inspector.runtimeLayerCanvasNote",
          "The renderer owns this layer's geometry, so the canvas only selects it. Edit the supported properties below.",
        );
  return note;
}

function createPropertyGroup({
  id,
  label,
  paired = false,
}: {
  id: string;
  label: string;
  paired?: boolean;
}) {
  const root = document.createElement("section");
  root.className = "inspector-property-group";
  root.dataset.propertyGroup = id;
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = label;
  const body = document.createElement("div");
  body.className = `inspector-property-grid${paired ? " paired" : ""}`;
  root.append(heading, body);
  return { body, root };
}

function createAdvancedPropertyGroup(ctx: ViewerAppContext) {
  const id = "layer-properties:advanced";
  const root = document.createElement("details");
  root.className = "inspector-property-group inspector-property-disclosure";
  root.dataset.propertyGroup = "advanced";
  root.open = ctx.state.expandedInspectorGroups.has(id);
  const summary = document.createElement("summary");
  summary.textContent = ctx.deps.t("viewer.inspector.advanced", "Advanced");
  const body = document.createElement("div");
  body.className = "inspector-property-grid";
  root.append(summary, body);
  root.addEventListener("toggle", () => {
    if (root.open) {
      ctx.state.expandedInspectorGroups.add(id);
    } else {
      ctx.state.expandedInspectorGroups.delete(id);
    }
  });
  return { body, root };
}

function localizeFields<P extends string>(
  ctx: ViewerAppContext,
  fields: readonly InspectorLocalizedNumberField<P>[],
): InspectorNumberField<P>[] {
  return fields.map((field) => ({
    ...field,
    label: field.labelKey
      ? ctx.deps.t(field.labelKey, field.labelFallback)
      : field.labelFallback,
  }));
}

export function createInspectorLayerPropertyActions(
  getContext: () => ViewerAppContext,
): Pick<InspectorPropertyActions, "appendLayerPropertiesInspector"> {
  return {
    appendLayerPropertiesInspector: bindViewerAction(
      appendLayerPropertiesInspector,
      getContext,
    ),
  };
}
