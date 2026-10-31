import type { EditorTimelineSource } from "../../editor/timeline-source.js";
import type { EditorTemplate } from "../../templates/model.js";
import type {
  KeyframeSelectionRef,
  KeyframeSelectionOptions,
  SelectionCollectionKind,
  SelectionModifiers,
  TimelineNavigationItem,
  ViewerSelection,
  InspectorFocusTab,
} from "./selection-model.js";

export interface TimelineSelectionActions {
  clearTimelineSelection(): void;
  clearSelection(): void;
  clearSelectionCollections(keep?: SelectionCollectionKind | null): void;
  selectLayer(layerId: string, event?: SelectionModifiers | null): void;
  selectClipBlock(layerId: string, event?: SelectionModifiers | null): void;
  selectPhaseBlock(phaseId: string, event?: SelectionModifiers | null): void;
  selectSceneBlock(sceneId: string, event?: SelectionModifiers | null): void;
  selectTrackLane(trackId: string): void;
  selectKeyframe(
    trackId: string,
    keyframeId: string,
    event?: SelectionModifiers | null,
  ): void;
  isSelectedLayer(layerId: string | null | undefined): boolean;
  isSelectedClip(layerId: string | null | undefined): boolean;
  isSelectedPhase(phaseId: string | null | undefined): boolean;
  isSelectedScene(sceneId: string | null | undefined): boolean;
  isSelectedKeyframe(
    trackId: string | null | undefined,
    keyframeId: string | null | undefined,
  ): boolean;
  setSelectedKeyframes(refs: unknown, options?: KeyframeSelectionOptions): void;
  toggleKeyframeSelection(
    ref: KeyframeSelectionRef,
    options?: KeyframeSelectionOptions,
  ): void;
  prepareKeyframeSelectionForPointer(
    event: SelectionModifiers,
    trackId: string,
    keyframeId: string,
  ): void;
  cycleTimelineSelection(direction: number): void;
  getVisibleTimelineSelectionItems(
    template: EditorTemplate,
  ): TimelineNavigationItem[];
  isTimelineSelectionItemCurrent(item: TimelineNavigationItem): boolean;
  applyTimelineSelectionItem(item: TimelineNavigationItem): void;
  scrollSelectedTimelineItemIntoView(): void;
  focusInspectorForSelection(): void;
  getInspectorFocusTabForSelection(
    item: Pick<ViewerSelection, "type"> | null | undefined,
  ): InspectorFocusTab;
  frameSelectedTimelineItem(): void;
  scrollTimelineElementHorizontallyIntoView(element: Element | null): void;
  navigateSelectedKeyframe(
    direction: number,
    options?: { extend?: boolean },
  ): void;
  reconcileTimelineSelection(template?: unknown): void;
  syncTimelineSelection(template?: EditorTimelineSource | null): void;
}
