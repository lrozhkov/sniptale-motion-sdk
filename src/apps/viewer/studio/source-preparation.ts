import type { ViewerAppContext } from "../app/context.js";
import type { EditorTemplateSource } from "../templates/model.js";
import type { EditorModule } from "../templates/state.js";
import type { ViewerAsset } from "../assets/state.js";
import type { StudioSource } from "./reload-coordinator.js";
import { isRecord } from "../../../shared/studio/revision-contract.js";
import {
  normalizeEffectV1ToTemplate,
  parseEffectV1Source,
  sha256EffectV1Bytes,
} from "../../../sdk/effect-v1/index.js";
import {
  prepareImportedAssets,
  verifyImportedAssets,
} from "../assets/layer-binding.js";
import { remapImportedAssetIdentity } from "../effect-file/import-asset-identity.js";
import { verifyMaterializedEffectImportSource } from "../effect-file/import-materialization.js";
import { readEditorTemplateSource } from "../templates/source.js";

export type PreparedStudioEffect = {
  template: EditorTemplateSource;
  module: EditorModule;
  assets: Map<string, ViewerAsset>;
  retiredAssets: Set<string>;
  registryUnchanged(): boolean;
};
export async function prepareStudioEffect(
  ctx: ViewerAppContext,
  source: StudioSource,
  previous: EditorTemplateSource | null,
): Promise<PreparedStudioEffect> {
  const assetEntries = [...ctx.state.assets];
  const baseEntries = [...ctx.state.baseAssets];
  const templates = ctx.state.templates;
  const registryUnchanged = () =>
    ctx.state.templates === templates &&
    sameEntries(ctx.state.assets, assetEntries) &&
    sameEntries(ctx.state.baseAssets, baseEntries);
  if (
    (await sha256EffectV1Bytes(new TextEncoder().encode(source.source))) !==
    source.studio.fingerprint
  )
    throw new Error("STUDIO_SOURCE_IDENTITY");
  const verified = await verifyMaterializedEffectImportSource(source.source);
  const validation = parseEffectV1Source(verified);
  if (
    !validation.ok ||
    !validation.document ||
    validation.document.id !== source.studio.effectId
  )
    throw new Error("STUDIO_SOURCE_INVALID");
  let id = previous?.id ?? source.studio.effectId;
  if (!previous && templates.some((template) => template.id === id)) {
    let suffix = 2;
    const base = `${id}-project`;
    id = base;
    while (templates.some((template) => template.id === id))
      id = `${base}-${suffix++}`;
  }
  const sharedAssets = new Set(
    templates
      .filter((template) => template !== previous)
      .flatMap((template) => template.assets ?? []),
  );
  const retiredAssets = new Set(
    (previous?.assets ?? []).filter((asset) => !sharedAssets.has(asset)),
  );
  const usedAssets = new Set(
    [...ctx.state.assets.keys(), ...ctx.state.baseAssets.keys()].filter(
      (asset) => !retiredAssets.has(asset),
    ),
  );
  const document = {
    ...remapImportedAssetIdentity(validation.document, usedAssets, id),
    id,
  };
  let moduleId = `${id}-studio-source`;
  let suffix = 2;
  while (ctx.state.modules.has(moduleId) && previous?.moduleId !== moduleId)
    moduleId = `${id}-studio-source-${suffix++}`;
  const template = readEditorTemplateSource({
    ...normalizeEffectV1ToTemplate(document),
    id,
    moduleId,
  });
  const assets = prepareImportedAssets(ctx, document.assets);
  await verifyImportedAssets(ctx, assets);
  if (!ctx.state.sandboxReady) throw new Error("STUDIO_SANDBOX_NOT_READY");
  const result: unknown = await ctx.requestSandbox(
    {
      document,
      kind: "validateEffectDocument",
      requestId: ctx.deps.createRequestId("studio-preflight"),
    },
    ctx.deps.DEFAULT_LOAD_TIMEOUT_MS,
  );
  if (!isRecord(result) || result.ok !== true)
    throw new Error("STUDIO_SANDBOX_REJECTED");
  return {
    template,
    module: {
      document,
      id: moduleId,
      path: source.sourceName,
      revision: source.studio.fingerprint,
    },
    assets,
    retiredAssets,
    registryUnchanged,
  };
}
function sameEntries<T>(
  map: ReadonlyMap<string, T>,
  entries: Array<[string, T]>,
): boolean {
  return (
    map.size === entries.length &&
    entries.every(([id, value]) => map.get(id) === value)
  );
}
