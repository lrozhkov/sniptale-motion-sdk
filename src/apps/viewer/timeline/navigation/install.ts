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
  ctx.getTimelineLayerSearchResults = getTimelineLayerSearchResults.bind(
    undefined,
    ctx,
  );
  ctx.createTimelineLayerSearchIndex = createTimelineLayerSearchIndex.bind(
    undefined,
    ctx,
  );
  ctx.filterTimelineLayerSearchResults = filterTimelineLayerSearchResults.bind(
    undefined,
    ctx,
  );
  ctx.getTimelineLayerOccurrences = getTimelineLayerOccurrences.bind(
    undefined,
    ctx,
  );
  ctx.normalizeTimelineLayerSearch = normalizeTimelineLayerSearch;
  installTimelineLayerRevealOwner(ctx);
  installTimelineLayerSearchController(ctx);
}
