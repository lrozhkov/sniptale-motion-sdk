import type { EditorTemplateSource } from "../../templates/model.js";
import type { EditorTimelineSource } from "../../editor/timeline-source.js";
export type TimelineLayerSearchResult = {
  depth: number;
  expansionIds: string[];
  globalScope: boolean;
  hidden: boolean;
  key: string;
  layerId: string;
  locked: boolean;
  name: string;
  path: string[];
  sceneId: string | null;
  sceneLabel: string;
  typeLabel: string;
};

export type TimelineLayerSearchIndex = {
  source: EditorTemplateSource | null;
  editorOverride: unknown;
  timelineOverride: unknown;
  locale: string;
  results: readonly TimelineLayerSearchResult[];
};
export interface TimelineNavigationActions {
  createTimelineLayerSearchIndex(
    template: EditorTimelineSource | null,
  ): TimelineLayerSearchResult[];
  filterTimelineLayerSearchResults(
    index: readonly TimelineLayerSearchResult[],
    query: unknown,
    limit?: number,
  ): TimelineLayerSearchResult[];
  getTimelineLayerOccurrences(
    template: EditorTimelineSource | null,
    layerId: string,
  ): TimelineLayerSearchResult[];
  normalizeTimelineLayerSearch(value: unknown): string;
  closeTimelineLayerSearch(options?: {
    clear?: boolean;
    focusTrigger?: boolean;
  }): void;
  openTimelineLayerSearch(): void;
  renderTimelineLayerSearch(): void;
  wireTimelineLayerSearch(): void;
  revealTimelineLayer(
    result: TimelineLayerSearchResult,
    options?: { focus?: boolean; select?: boolean },
  ): boolean;
  revealTimelineLayerById(
    layerId: string,
    options?: { focus?: boolean; select?: boolean },
  ): boolean;
}
