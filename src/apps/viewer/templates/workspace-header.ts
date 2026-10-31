import { bindViewerAction } from "../app/bind-action.js";
import type { ViewerAppContext } from "../app/context.js";
import type {
  TemplateModelActions,
  TemplatePresentationSource,
} from "./contract.js";
import {
  getTemplateArtifactTypeLabel,
  resolveTemplateArtifactType,
} from "./artifact-type.js";
import {
  getTemplateBundleKindLabel,
  resolveTemplateBundleKind,
  getTemplateBundleKindDescription,
} from "./bundle-kind.js";

function updateTemplateContext(
  ctx: ViewerAppContext,
  template: TemplatePresentationSource | null = ctx.state.currentTemplate,
) {
  if (!template) {
    ctx.refs.templateContext.textContent = "";
    ctx.refs.templateContext.title = "";
    return;
  }
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const layers = effectiveTemplate?.layers?.length ?? 0;
  const tracks = effectiveTemplate?.timeline?.tracks?.length ?? 0;
  const duration = ctx.formatSeconds(
    effectiveTemplate?.duration ?? template.duration ?? 0,
  );
  const summary = ctx.deps
    .t(
      "viewer.templates.summary",
      "{layers} layers · {tracks} tracks · {duration}",
    )
    .replace("{layers}", String(layers))
    .replace("{tracks}", String(tracks))
    .replace("{duration}", duration);
  ctx.refs.templateContext.textContent = "";
  const artifactType = resolveTemplateArtifactType(effectiveTemplate);
  const bundleKind = resolveTemplateBundleKind(effectiveTemplate);
  const artifactLabel = getTemplateArtifactTypeLabel(
    ctx.deps.t,
    effectiveTemplate,
  );
  const typeLabel = getTemplateBundleKindLabel(ctx.deps.t, effectiveTemplate);
  const type = document.createElement("strong");
  type.className = "template-artifact-type";
  type.dataset.artifactType = artifactType;
  type.dataset.bundleKind = bundleKind;
  type.dataset.compactLabel = artifactLabel;
  type.setAttribute("aria-label", typeLabel);
  type.textContent = typeLabel;
  const details = document.createElement("span");
  details.className = "template-context-summary";
  details.textContent = summary;
  ctx.refs.templateContext.append(type, details);
  ctx.refs.templateContext.hidden = false;
  ctx.refs.templateContext.title = `${ctx.deps.translateText(template.label, template.id)}\n${getTemplateBundleKindLabel(ctx.deps.t, effectiveTemplate)}: ${getTemplateBundleKindDescription(ctx.deps.t, effectiveTemplate)}\n${summary}`;
}

export function createTemplateContextActions(
  getContext: () => ViewerAppContext,
): Pick<TemplateModelActions, "updateTemplateContext"> {
  return {
    updateTemplateContext: bindViewerAction(updateTemplateContext, getContext),
  };
}
