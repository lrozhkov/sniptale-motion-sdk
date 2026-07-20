import { readAssets, validateTemplateAssetRefs } from "./assets.js";
import { validateManifest } from "./manifest.js";
import { readModules, validateModuleSources } from "./modules.js";
import { readJson } from "./readers.js";
import { readTemplates, validateTemplateModuleRefs } from "./templates.js";
import { normalizeEffectV1ToTemplate } from "../effect-v1/index.js";

export async function loadDemoPack(baseUrl = "./packs/demo/") {
  const errors = [];
  const manifest = await readJson(
    `${baseUrl}manifest.json`,
    errors,
    "manifest.json",
  );
  if (!manifest) {
    return {
      assets: new Map(),
      errors,
      modules: new Map(),
      pack: null,
      templates: [],
    };
  }

  validateManifest(manifest, errors);
  const assets = await readAssets(baseUrl, manifest, errors);
  const templates = await readTemplates(baseUrl, manifest, errors);
  const modules = await readModules(baseUrl, manifest, errors);
  for (const module of modules.values()) {
    if (module.document) {
      templates.push(normalizeEffectV1ToTemplate(module.document));
    }
  }
  validateTemplateAssetRefs(assets, templates, errors);
  validateTemplateModuleRefs(manifest, templates, errors);
  validateModuleSources(modules, errors);

  return errors.length
    ? { assets, errors, modules, pack: null, templates }
    : { assets, errors: [], modules, pack: manifest, templates };
}
