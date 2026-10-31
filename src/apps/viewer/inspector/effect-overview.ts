import { bindViewerAction } from "../app/bind-action.js";
import type { InspectorOverviewActions } from "./overview-contract.js";
import type {
  EditorTemplate,
  EditorTemplateSource,
} from "../templates/model.js";
import type { ViewerAppContext } from "../app/context.js";
import { getTemplateArtifactTypeLabel } from "../templates/artifact-type.js";
import { getTemplateBundleKindLabel } from "../templates/bundle-kind.js";

function renderEffectOverview(
  ctx: ViewerAppContext,
  template: EditorTemplateSource,
  effectiveTemplate: EditorTemplate,
) {
  const t = (key: string, fallback: string) => ctx.deps.t(key, fallback);
  const valid = t("viewer.inspector.values.valid", "Valid");
  const bundleKind = getTemplateBundleKindLabel(ctx.deps.t, effectiveTemplate);
  const artifactType = getTemplateArtifactTypeLabel(
    ctx.deps.t,
    effectiveTemplate,
  );
  ctx.setInspectorAppendSection("summary");
  ctx.appendInspectorRows(bundleKind, [
    [
      t("viewer.inspector.fields.template", "Template"),
      ctx.deps.translateText(template.label, template.id),
    ],
    [t("viewer.inspector.fields.bundleType", "Content type"), artifactType],
    [
      t("viewer.inspector.fields.duration", "Duration"),
      ctx.formatSeconds(effectiveTemplate.duration),
    ],
    [
      t("viewer.inspector.fields.loop", "Loop"),
      ctx.state.loopPlayback
        ? t("viewer.inspector.values.on", "On")
        : t("viewer.inspector.values.off", "Off"),
    ],
    [
      t("viewer.inspector.fields.scenes", "Scenes"),
      String((effectiveTemplate.scenes ?? []).length),
    ],
    [
      t("viewer.inspector.fields.layers", "Layers"),
      String(effectiveTemplate.layers.length),
    ],
    [
      t("viewer.inspector.fields.tracks", "Tracks"),
      String(effectiveTemplate.timeline.tracks.length),
    ],
    [
      t("viewer.inspector.fields.state", "State"),
      ctx.hasInvalidTiming(effectiveTemplate)
        ? t("viewer.inspector.values.timingWarnings", "Has timing warnings")
        : valid,
    ],
  ]);
}

export function createInspectorEffectOverviewActions(
  getContext: () => ViewerAppContext,
): Pick<InspectorOverviewActions, "renderEffectOverview"> {
  return {
    renderEffectOverview: bindViewerAction(renderEffectOverview, getContext),
  };
}
