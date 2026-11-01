import { bindViewerAction } from "../app/bind-action.js";
import type { EffectFileActions, EffectImportResult } from "./contract.js";
import { getStudioSession } from "./local-catalog.js";
import type { ViewerAppContext } from "../app/context.js";

async function bootstrapLocalEffects(ctx: ViewerAppContext): Promise<boolean> {
  const catalog = await ctx.deps.loadLocalEffectCatalog();
  const errors = [...catalog.errors];
  const showErrors = () => {
    ctx.refs.localEffectErrors.hidden = errors.length === 0;
    ctx.refs.localEffectErrorDetails.textContent = errors
      .map((error) => error.slice(0, 4000))
      .join("\n");
  };
  showErrors();
  catalog.errors.forEach((error) =>
    ctx.logDiagnostic(`Local effect discovery: ${error}`, "error"),
  );
  if (catalog.effects.length === 0 && !getStudioSession()) return false;

  ctx.state.assets = new Map();
  ctx.state.baseAssets = new Map();
  ctx.state.modules = new Map();
  ctx.state.pack = { packId: "sniptale.local-effects" };
  ctx.state.templates = [];
  ctx.state.startupTemplateId = null;

  let imported = 0;
  let firstImportedTemplateId: string | null = null;
  for (const effect of catalog.effects) {
    let result: EffectImportResult;
    try {
      result = await ctx.importEffectFileSource(
        effect.source,
        effect.sourceName,
        {
          appendImportedLabel: false,
          preferOriginalId: true,
          select: false,
        },
      );
    } catch (error) {
      const message = `${effect.sourceName}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(message);
      ctx.logDiagnostic(message, "error");
      continue;
    }
    if (!result.ok || !result.templateId) {
      errors.push(
        ...result.errors.map((error) => `${effect.sourceName}: ${error}`),
      );
      continue;
    }
    if (effect.studio)
      ctx.state.studio.sources.set(result.templateId, effect.studio);
    imported += 1;
    firstImportedTemplateId ??= result.templateId;
    const template = ctx.state.templates.find(
      (item) => item.id === result.templateId,
    );
    if (effect.default && template) {
      template.default = true;
      ctx.state.startupTemplateId = template.id;
    }
  }
  showErrors();
  if (getStudioSession()) ctx.state.studio.ready = true;
  if (imported === 0) {
    if (!getStudioSession()) return false;
    ctx.populateTemplates(ctx.state.templates);
    ctx.setPackStatus(
      ctx.deps.t(
        errors.length
          ? "viewer.status.localEffectsRejected"
          : "viewer.status.readyForImport",
      ),
      errors.length ? "error" : "ready",
    );
    return true;
  }
  ctx.state.startupTemplateId ??= firstImportedTemplateId;
  ctx.populateTemplates(ctx.state.templates);
  const status = ctx.deps
    .t("viewer.status.loadedLocalEffects", "Loaded {count} local effects")
    .replace("{count}", String(imported));
  ctx.setPackStatus(status, "ready");
  ctx.logDiagnostic(status, "ok");
  void ctx.selectInitialTemplateWhenReady();
  return true;
}

export function createLocalEffectStartupActions(
  getContext: () => ViewerAppContext,
): Pick<EffectFileActions, "bootstrapLocalEffects"> {
  return {
    bootstrapLocalEffects: bindViewerAction(bootstrapLocalEffects, getContext),
  };
}
