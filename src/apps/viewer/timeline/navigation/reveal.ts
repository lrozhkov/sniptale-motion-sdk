import type { ViewerAppContext } from "../../app/context.js";
import type { TimelineLayerSearchResult } from "./search-model.js";

export function revealTimelineLayer(
  ctx: ViewerAppContext,
  result: TimelineLayerSearchResult,
  options: { focus?: boolean; select?: boolean } = {},
): boolean {
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (
    !template ||
    !effectiveTemplate?.layers?.some((layer) => layer.id === result.layerId)
  ) {
    return false;
  }
  expandTimelineLayerPath(ctx, result);
  if (options.select !== false) {
    ctx.selectCanvasLayers([result.layerId], result.layerId, { sync: false });
  }
  const rowIndex = ctx.getTimelineLayerRowIndex(template, result);
  if (rowIndex >= 0) {
    ctx.scrollTimelineRowIntoView(rowIndex);
  }
  ctx.renderTimelineStructure(template);
  ctx.syncTimelineSelection(template);
  if (options.focus !== false) {
    requestAnimationFrame(() => focusRevealedTimelineLayer(ctx, result));
  }
  return true;
}

export function revealTimelineLayerById(
  ctx: ViewerAppContext,
  layerId: string,
  options: { focus?: boolean; select?: boolean } = {},
): boolean {
  const template = ctx.state.currentTemplate;
  const occurrences = ctx.getTimelineLayerOccurrences(template, layerId);
  if (occurrences.length === 0) {
    return false;
  }
  const playheadSceneId = ctx.findSceneIdAtTime(
    template,
    Number(ctx.refs.timeSlider.value) || 0,
  );
  const result =
    occurrences.find((candidate) => candidate.sceneId === playheadSceneId) ??
    occurrences.find((candidate) => candidate.globalScope) ??
    occurrences[0];
  return revealTimelineLayer(ctx, result, options);
}

function expandTimelineLayerPath(
  ctx: ViewerAppContext,
  result: TimelineLayerSearchResult,
): void {
  if (result.sceneId) {
    ctx.state.expandedSceneIds.add(result.sceneId);
    ctx.setTimelineRowExpanded("scene", result.sceneId, true);
  }
  for (const expansionId of result.expansionIds) {
    ctx.setTimelineRowExpanded("group", expansionId, true);
  }
}

function focusRevealedTimelineLayer(
  ctx: ViewerAppContext,
  result: TimelineLayerSearchResult,
): void {
  const selector = `.layer-lane[data-layer-id="${ctx.cssEscape(result.layerId)}"]`;
  const candidates = Array.from(
    ctx.refs.timelineTracks.querySelectorAll(selector),
  ) as HTMLElement[];
  const row =
    candidates.find((candidate) =>
      result.globalScope
        ? candidate.dataset.timelineScope === "global"
        : candidate.dataset.parentSceneId === result.sceneId,
    ) ?? candidates[0];
  if (!row) {
    return;
  }
  const container = ctx.refs.timelineTracks;
  const containerRect = container.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  container.scrollTop +=
    rowRect.top -
    containerRect.top -
    Math.max(0, (containerRect.height - rowRect.height) / 2);
  row.classList.add("search-revealed");
  const label = row.querySelector(".timeline-lane-label") as HTMLElement | null;
  if (label) {
    label.tabIndex = -1;
    label.focus({ preventScroll: true });
  }
  window.setTimeout(() => row.classList.remove("search-revealed"), 900);
}

export function installTimelineLayerRevealOwner(ctx: ViewerAppContext): void {
  ctx.revealTimelineLayer = (...args: any[]) =>
    (revealTimelineLayer as any)(ctx, ...args);
  ctx.revealTimelineLayerById = (...args: any[]) =>
    (revealTimelineLayerById as any)(ctx, ...args);
}
