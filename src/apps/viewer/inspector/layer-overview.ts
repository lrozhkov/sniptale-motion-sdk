import type { ViewerAppContext } from "../app/context.js";

export function appendLayerSelectionOverview(
  ctx: ViewerAppContext,
  item,
  effectiveTemplate,
) {
  if (ctx.isLayerSelectionInspector?.(effectiveTemplate)) {
    ctx.appendLayerMultiSelectionOverview(effectiveTemplate);
    return;
  }
  const t = (key, fallback) => ctx.deps.t(key, fallback);
  const layer = effectiveTemplate.layers.find(
    (entry) => entry.id === item.layerId,
  );
  const clip = effectiveTemplate.clips.find(
    (entry) => entry.layerId === item.layerId,
  );
  if (ctx.isInspectorSectionActive("summary")) {
    ctx.setInspectorAppendSection("summary");
    ctx.appendInspectorRows(t("viewer.inspector.context.layer", "Layer"), [
      [t("viewer.inspector.fields.name", "Name"), layer?.name ?? item.layerId],
      ["ID", item.layerId],
      [
        t("viewer.inspector.fields.type", "Type"),
        layer
          ? t(`viewer.timeline.layerTypes.${layer.type}`, layer.type)
          : t("viewer.inspector.values.unknown", "Unknown"),
      ],
      [
        t("viewer.inspector.fields.state", "State"),
        layer?.locked
          ? t("viewer.inspector.values.locked", "Locked")
          : layer?.visible === false
            ? t("viewer.inspector.values.hidden", "Hidden")
            : t("viewer.inspector.values.visible", "Visible"),
      ],
    ]);
  }
  if (layer && ctx.isInspectorSectionActive("transform")) {
    ctx.setInspectorAppendSection("transform");
    ctx.appendLayerPropertiesInspector(layer);
  }
  if (clip && ctx.isInspectorSectionActive("ownership")) {
    ctx.setInspectorAppendSection("ownership");
    ctx.appendClipOwnershipEditor(clip, effectiveTemplate);
    ctx.appendTimingOwnershipInspector(
      ctx.getClipOwnershipSummary(effectiveTemplate, clip),
    );
  }
}

export function appendClipSelectionOverview(
  ctx: ViewerAppContext,
  item,
  effectiveTemplate,
) {
  const t = (key, fallback) => ctx.deps.t(key, fallback);
  const clip = effectiveTemplate.clips.find(
    (entry) => entry.layerId === item.layerId,
  );
  const layer = effectiveTemplate.layers.find(
    (entry) => entry.id === item.layerId,
  );
  if (ctx.isInspectorSectionActive("summary")) {
    ctx.setInspectorAppendSection("summary");
    ctx.appendInspectorRows(
      t("viewer.inspector.context.clip", "Layer interval"),
      [
        [
          t("viewer.inspector.fields.layer", "Layer"),
          layer?.name ?? item.layerId,
        ],
        [
          t("viewer.inspector.fields.start", "Start"),
          ctx.formatSeconds(clip?.start ?? 0),
        ],
        [
          t("viewer.inspector.fields.duration", "Duration"),
          ctx.formatSeconds(clip?.duration ?? 0),
        ],
        [
          t("viewer.inspector.fields.offset", "Offset"),
          ctx.formatSeconds(clip?.offset ?? 0),
        ],
        [
          t("viewer.inspector.fields.state", "State"),
          clip &&
          ctx.isRangeInvalid(
            clip.start,
            clip.duration,
            effectiveTemplate.duration,
          )
            ? t("viewer.inspector.values.outOfRange", "Out of range")
            : t("viewer.inspector.values.valid", "Valid"),
        ],
      ],
    );
  }
  if (clip && ctx.isInspectorSectionActive("timing")) {
    ctx.setInspectorAppendSection("timing");
    ctx.appendClipTimingInspector(clip, effectiveTemplate.duration);
  }
  if (clip && ctx.isInspectorSectionActive("ownership")) {
    ctx.setInspectorAppendSection("ownership");
    ctx.appendClipOwnershipEditor(clip, effectiveTemplate);
    ctx.appendTimingOwnershipInspector(
      ctx.getClipOwnershipSummary(effectiveTemplate, clip),
    );
  }
}

export function installInspectorLayerOverviewOwner(
  ctx: ViewerAppContext,
): void {
  ctx.appendLayerSelectionOverview = appendLayerSelectionOverview.bind(
    undefined,
    ctx,
  );
  ctx.appendClipSelectionOverview = appendClipSelectionOverview.bind(
    undefined,
    ctx,
  );
}
