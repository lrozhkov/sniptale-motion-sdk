export type ViewerInteractionState = {
  pointerDragCleanup: (() => void) | null;
  timelineDragSession: object | null;
  dragMoved: boolean;
  dragSuppressClickKey: string | null;
  dragSuppressClickTarget: EventTarget | null;
  dragSuppressClickUntil: number;
  inspectorSelectionKey: string | null;
  snapIndicatorTimer: number | null;
  startupTemplateId: string | null;
  pendingAssetReplaceId: string | null;
  templateFileHandle: FileSystemFileHandle | null;
};

export function createViewerInteractionState(): ViewerInteractionState {
  return {
    pointerDragCleanup: null,
    timelineDragSession: null,
    dragMoved: false,
    dragSuppressClickKey: null,
    dragSuppressClickTarget: null,
    dragSuppressClickUntil: 0,
    inspectorSelectionKey: null,
    snapIndicatorTimer: null,
    startupTemplateId: null,
    pendingAssetReplaceId: null,
    templateFileHandle: null,
  };
}
