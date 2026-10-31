import type { TimelineExpansionType } from "./row-tree-model.js";

export interface TimelineRowTreeActions {
  createExpandedTimelineRowIdSet(template?: unknown): Set<string>;
  createInitialTimelineRowIdSet(template?: unknown): Set<string>;
  getTimelineRowExpansionId(type: TimelineExpansionType, id: string): string;
  isTimelineRowExpanded(type: TimelineExpansionType, id: string): boolean;
  setAllTimelineRowsExpanded(expanded: boolean): void;
  setTimelineRowExpanded(
    type: TimelineExpansionType,
    id: string,
    expanded: boolean,
  ): void;
  toggleTimelineRowExpansion(type: TimelineExpansionType, id: string): void;
}
