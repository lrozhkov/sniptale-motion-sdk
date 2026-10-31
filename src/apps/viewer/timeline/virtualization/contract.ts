import type { TimelineRowTree } from "../model/row-tree-model.js";
import type {
  TimelineLayerRowTarget,
  TimelineItemRowTarget,
} from "./row-order-model.js";

export interface TimelineVirtualizationActions {
  beginTimelineVirtualRender(tree: TimelineRowTree, scrollTop?: number): void;
  endTimelineVirtualRender(): void;
  getTimelineLayerRowIndex(
    template: unknown,
    target: TimelineLayerRowTarget,
  ): number;
  getTimelineItemRowIndex(
    template: unknown,
    item: TimelineItemRowTarget,
  ): number;
  scheduleTimelineVirtualRender(): void;
  scrollTimelineRowIntoView(
    rowIndex: number,
    align?: "center" | "nearest",
  ): boolean;
  claimTimelineVirtualRow(): number | null;
}
