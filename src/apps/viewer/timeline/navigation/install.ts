import type { ViewerAppContext } from "../../app/context.js";
import {
  createTimelineLayerSearchIndex,
  filterTimelineLayerSearchResults,
  getTimelineLayerOccurrences,
  getTimelineLayerSearchResults,
  normalizeTimelineLayerSearch,
} from "./search-model.js";
import { installTimelineLayerRevealOwner } from "./reveal.js";
import { installTimelineLayerSearchController } from "./search-controller.js";

export function installTimelineNavigationOwners(ctx: ViewerAppContext): void {
  ctx.getTimelineLayerSearchResults = (...args: any[]) =>
    (getTimelineLayerSearchResults as any)(ctx, ...args);
  ctx.createTimelineLayerSearchIndex = (...args: any[]) =>
    (createTimelineLayerSearchIndex as any)(ctx, ...args);
  ctx.filterTimelineLayerSearchResults = (...args: any[]) =>
    (filterTimelineLayerSearchResults as any)(ctx, ...args);
  ctx.getTimelineLayerOccurrences = (...args: any[]) =>
    (getTimelineLayerOccurrences as any)(ctx, ...args);
  ctx.normalizeTimelineLayerSearch = normalizeTimelineLayerSearch;
  installTimelineLayerRevealOwner(ctx);
  installTimelineLayerSearchController(ctx);
}
