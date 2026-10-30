import type { ViewerAppContext } from "../app/context.js";

async function bootstrapLocalEffects(ctx: ViewerAppContext): Promise<boolean> {
  const catalog = await ctx.deps.loadLocalEffectCatalog();
  catalog.errors.forEach((error) =>
    ctx.logDiagnostic(`Local effect discovery: ${error}`, "error"),
  );
  if (catalog.effects.length === 0) return false;

  ctx.state.assets = new Map();
  ctx.state.baseAssets = new Map();
  ctx.state.modules = new Map();
  ctx.state.pack = { packId: "sniptale.local-effects" };
  ctx.state.templates = [];
  ctx.state.startupTemplateId = null;

  let imported = 0;
  let firstImportedTemplateId: string | null = null;
  for (const effect of catalog.effects) {
    const result = await ctx.importEffectFileSource(
      effect.source,
      effect.sourceName,
      {
        appendImportedLabel: false,
        preferOriginalId: true,
        select: false,
      },
    );
    if (!result.ok || !result.templateId) continue;
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
  if (imported === 0) return false;
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

export function installLocalEffectStartupOwner(ctx: ViewerAppContext): void {
  ctx.bootstrapLocalEffects = bootstrapLocalEffects.bind(undefined, ctx);
}
