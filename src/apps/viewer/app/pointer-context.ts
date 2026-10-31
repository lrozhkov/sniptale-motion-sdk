import type { ViewerInteractionState } from "./interaction-state.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";

export type PointerDragContext = {
  state: Pick<
    ViewerInteractionState,
    | "pointerDragCleanup"
    | "dragMoved"
    | "dragSuppressClickKey"
    | "dragSuppressClickTarget"
    | "dragSuppressClickUntil"
  > & { currentTemplate: EditorTimelineSource | null };
  getEditorContentFingerprint?(): string;
  markEditorChanged?(reason: string, options: { immediate: boolean }): void;
};
