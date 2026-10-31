import { bindViewerAction } from "../../app/bind-action.js";
import type { ViewerAppContext } from "../../app/context.js";
import type { TimelineNavigationActions } from "./contract.js";
import {
  createTimelineLayerSearchIndex,
  filterTimelineLayerSearchResults,
  getTimelineLayerOccurrences,
  normalizeTimelineLayerSearch,
} from "./search-model.js";
import { createTimelineLayerRevealActions } from "./reveal.js";
import { createTimelineLayerSearchActions } from "./search-controller.js";

export function createTimelineLayerNavigationActions(
  getContext: () => ViewerAppContext,
): TimelineNavigationActions {
  return {
    createTimelineLayerSearchIndex: bindViewerAction(
      createTimelineLayerSearchIndex,
      getContext,
    ),
    filterTimelineLayerSearchResults: bindViewerAction(
      filterTimelineLayerSearchResults,
      getContext,
    ),
    getTimelineLayerOccurrences: bindViewerAction(
      getTimelineLayerOccurrences,
      getContext,
    ),
    normalizeTimelineLayerSearch,
    ...createTimelineLayerRevealActions(getContext),
    ...createTimelineLayerSearchActions(getContext),
  };
}
