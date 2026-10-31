import type { ViewerAppContext } from "../app/context.js";
import type { EditorTemplateSource } from "../templates/model.js";
import type { PreparedStudioEffect } from "./source-preparation.js";
import type { StudioSource } from "./reload-coordinator.js";
import { selectTemplate } from "../templates/selection.js";

function installSource(
  ctx: ViewerAppContext,
  prepared: PreparedStudioEffect,
  source: StudioSource,
  previous: EditorTemplateSource | null,
): void {
  const assets = new Map(ctx.state.assets);
  const baseAssets = new Map(ctx.state.baseAssets);
  for (const id of prepared.retiredAssets) {
    assets.delete(id);
    baseAssets.delete(id);
  }
  for (const [id, asset] of prepared.assets) {
    assets.set(id, asset);
    baseAssets.set(id, asset);
  }
  const templates = previous
    ? ctx.state.templates.map((template) =>
        template === previous ? prepared.template : template,
      )
    : [...ctx.state.templates, prepared.template];
  const modules = new Map(ctx.state.modules);
  if (
    typeof previous?.moduleId === "string" &&
    previous.moduleId !== prepared.module.id &&
    !templates.some((template) => template.moduleId === previous.moduleId)
  )
    modules.delete(previous.moduleId);
  modules.set(prepared.module.id, prepared.module);
  ctx.state.modules = modules;
  ctx.state.assets = assets;
  ctx.state.baseAssets = baseAssets;
  ctx.state.templates = templates;
  ctx.state.loadedModules.delete(prepared.module.id);
  ctx.state.studio.sources.set(prepared.template.id, source.studio);
}
export async function applyStudioSource(
  ctx: ViewerAppContext,
  prepared: PreparedStudioEffect,
  source: StudioSource,
  previous: EditorTemplateSource,
  canCommit: () => boolean,
): Promise<boolean> {
  if (
    !canCommit() ||
    !prepared.registryUnchanged() ||
    ctx.state.templateSelectionPending
  )
    return false;
  let committed = false;
  await selectTemplate(ctx, previous.id, {
    restoreDraft: false,
    canSelect: () => canCommit() && prepared.registryUnchanged(),
    beforeReset: () => {
      installSource(ctx, prepared, source, previous);
      committed = true;
    },
  });
  if (committed) ctx.populateTemplates(ctx.state.templates);
  return committed && ctx.state.currentTemplate === prepared.template;
}
export async function addStudioSource(
  ctx: ViewerAppContext,
  prepared: PreparedStudioEffect,
  source: StudioSource,
  canCommit: () => boolean,
): Promise<boolean> {
  if (
    !canCommit() ||
    !prepared.registryUnchanged() ||
    ctx.state.templateSelectionPending
  )
    return false;
  installSource(ctx, prepared, source, null);
  ctx.populateTemplates(ctx.state.templates);
  if (!ctx.state.currentTemplate)
    await selectTemplate(ctx, prepared.template.id, { restoreDraft: false });
  return true;
}
