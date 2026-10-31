import type {
  TimelineLayerSearchResult,
  TimelineLayerSearchIndex,
} from "./contract.js";
import type { EditorTemplateSource } from "../../templates/model.js";
import type { EditorTimelineSource } from "../../editor/timeline-source.js";
import type {
  TimelineLayerRow,
  TimelineScene,
} from "../model/row-tree-model.js";
import type { ViewerAppContext } from "../../app/context.js";

export function getTimelineLayerSearchResults(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null,
  query: unknown,
  limit = 40,
): TimelineLayerSearchResult[] {
  return filterTimelineLayerSearchResults(
    ctx,
    createTimelineLayerSearchIndex(ctx, template),
    query,
    limit,
  );
}

export function createTimelineLayerSearchIndex(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null,
): TimelineLayerSearchResult[] {
  return collectTimelineLayerSearchResults(ctx, template);
}

export function filterTimelineLayerSearchResults(
  ctx: ViewerAppContext,
  index: readonly TimelineLayerSearchResult[],
  query: unknown,
  limit = 40,
): TimelineLayerSearchResult[] {
  const normalizedQuery = normalizeTimelineLayerSearch(query);
  if (!normalizedQuery) {
    return [];
  }
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  return index
    .map((result) => ({
      result,
      score: getSearchScore(result, tokens),
    }))
    .filter(({ score }) => Number.isFinite(score))
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.result.depth - b.result.depth ||
        a.result.name.localeCompare(b.result.name, ctx.deps.getLocale()),
    )
    .slice(0, Math.max(1, Number(limit) || 40))
    .map(({ result }) => result);
}

export function getTimelineLayerOccurrences(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null,
  layerId: string,
): TimelineLayerSearchResult[] {
  return createTimelineLayerSearchIndex(ctx, template).filter(
    (result) => result.layerId === layerId,
  );
}

export function normalizeTimelineLayerSearch(value: unknown): string {
  return String(
    typeof value === "string" || typeof value === "number" ? value : "",
  )
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, " ")
    .trim();
}

function collectTimelineLayerSearchResults(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null,
): TimelineLayerSearchResult[] {
  if (!template) {
    return [];
  }
  const tree = ctx.createTimelineRowTree(template);
  const results: TimelineLayerSearchResult[] = [];
  appendRows(tree.globalLayers ?? [], null, [], [], true);
  for (const sceneRow of tree.scenes ?? []) {
    appendRows(sceneRow.layers, sceneRow.scene, [], [], false);
  }
  return results;

  function appendRows(
    rows: readonly TimelineLayerRow[],
    scene: TimelineScene | null,
    ancestorNames: string[],
    expansionIds: string[],
    globalScope: boolean,
  ): void {
    for (const row of rows) {
      const layer = row.layer ?? null;
      const name = ctx.deps.translateText(layer?.name, row.layerId);
      const type = layer?.type ?? "layer";
      const typeLabel =
        type === "layer"
          ? ctx.deps.t("viewer.timeline.layer", "Layer")
          : ctx.deps.t(`viewer.timeline.layerTypes.${type}`, type);
      const sceneLabel = globalScope
        ? ctx.deps.t("viewer.timeline.scopes.global", "Global")
        : ctx.deps.translateText(scene?.label, scene?.id ?? "");
      results.push({
        depth: Number(row.depth) || 0,
        expansionIds: [...expansionIds],
        globalScope,
        hidden: layer?.visible === false,
        key: `${globalScope ? "global" : scene?.id}:${row.layerId}`,
        layerId: row.layerId,
        locked: layer?.locked === true,
        name,
        path: [...ancestorNames, name],
        sceneId: globalScope ? null : (scene?.id ?? null),
        sceneLabel,
        typeLabel,
      });
      if (row.kind === "group") {
        appendRows(
          row.children,
          scene,
          [...ancestorNames, name],
          [...expansionIds, row.expansionId],
          globalScope,
        );
      }
    }
  }
}

function getSearchScore(
  result: TimelineLayerSearchResult,
  tokens: string[],
): number {
  const name = normalizeTimelineLayerSearch(result.name);
  const layerId = normalizeTimelineLayerSearch(result.layerId);
  const path = normalizeTimelineLayerSearch(result.path.join(" "));
  const metadata = normalizeTimelineLayerSearch(
    `${result.typeLabel} ${result.sceneLabel}`,
  );
  const searchable = `${name} ${layerId} ${path} ${metadata}`;
  if (!tokens.every((token) => searchable.includes(token))) {
    return Number.POSITIVE_INFINITY;
  }
  const phrase = tokens.join(" ");
  if (name === phrase) return 0;
  if (name.startsWith(phrase)) return 1;
  if (name.includes(phrase)) return 2;
  if (layerId.startsWith(phrase)) return 3;
  if (path.includes(phrase)) return 4;
  return 5;
}

export type TimelineSearchIndexContext = {
  state: {
    currentTemplate: EditorTemplateSource | null;
    editorOverrides: ReadonlyMap<string, unknown>;
    timelineOverrides: ReadonlyMap<string, unknown>;
  };
  deps: { getLocale(): string };
  timelineLayerSearchIndexCache: TimelineLayerSearchIndex | null;
  createTimelineLayerSearchIndex(
    template: EditorTimelineSource | null,
  ): TimelineLayerSearchResult[];
};

export function getCachedTimelineLayerSearchIndex(
  ctx: TimelineSearchIndexContext,
): readonly TimelineLayerSearchResult[] {
  const source = ctx.state.currentTemplate;
  const locale = ctx.deps.getLocale();
  const editorOverride = source
    ? ctx.state.editorOverrides.get(source.id)
    : undefined;
  const timelineOverride = source
    ? ctx.state.timelineOverrides.get(source.id)
    : undefined;
  let cache = ctx.timelineLayerSearchIndexCache;
  if (
    !cache ||
    cache.source !== source ||
    cache.locale !== locale ||
    cache.editorOverride !== editorOverride ||
    cache.timelineOverride !== timelineOverride
  ) {
    cache = {
      source,
      locale,
      editorOverride,
      timelineOverride,
      results: ctx.createTimelineLayerSearchIndex(source),
    };
    ctx.timelineLayerSearchIndexCache = cache;
  }
  return cache.results;
}
