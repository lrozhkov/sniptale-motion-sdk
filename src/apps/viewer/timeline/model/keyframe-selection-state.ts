import { bindViewerAction } from "../../app/bind-action.js";
import type {
  KeyframeSelectionRef,
  KeyframeSelectionOptions,
  SelectionModifiers,
} from "./selection-model.js";
import type { ViewerAppContext } from "../../app/context.js";
import { syncCanvasSelection } from "./selection-state.js";
import { canonicalizeKeyframeSelection } from "./keyframe-selection.js";
function selectKeyframe(
  ctx: ViewerAppContext,
  trackId: string,
  keyframeId: string,
  event: SelectionModifiers | null = null,
): void {
  const ref = { keyframeId, trackId };
  if (event?.shiftKey || event?.metaKey || event?.ctrlKey) {
    ctx.toggleKeyframeSelection(ref, { render: false });
  } else {
    ctx.setSelectedKeyframes([ref], { render: false });
  }
  ctx.setSidebarGroup("inspect");
  ctx.syncTimelineSelection(ctx.state.currentTemplate);
}

function isSelectedKeyframe(
  ctx: ViewerAppContext,
  trackId: string | null | undefined,
  keyframeId: string | null | undefined,
): boolean {
  return ctx.state.selectedKeyframes.some(
    (item) => item.trackId === trackId && item.keyframeId === keyframeId,
  );
}

function setSelectedKeyframes(
  ctx: ViewerAppContext,
  refs: unknown,
  options: KeyframeSelectionOptions = {},
): void {
  const timeline = ctx.getEffectiveTimeline(ctx.state.currentTemplate);
  ctx.state.selectedKeyframes = canonicalizeKeyframeSelection(timeline, refs);
  if (options.preserveMotionPathContext !== true) {
    ctx.state.canvasMotionPathContextLayerIds = [];
  }
  ctx.clearSelectionCollections("keyframe");
  const primary = ctx.state.selectedKeyframes.at(-1) ?? null;
  ctx.state.selectedItem = primary
    ? { ...primary, type: "keyframe" }
    : { type: "effect" };
  if (options.render !== false) {
    ctx.syncTimelineSelection(ctx.state.currentTemplate);
  }
}

function toggleKeyframeSelection(
  ctx: ViewerAppContext,
  ref: KeyframeSelectionRef,
  options: KeyframeSelectionOptions = {},
): void {
  const index = ctx.state.selectedKeyframes.findIndex(
    (item) =>
      item.trackId === ref.trackId && item.keyframeId === ref.keyframeId,
  );
  if (index >= 0) {
    ctx.state.selectedKeyframes.splice(index, 1);
  } else {
    ctx.state.selectedKeyframes.push(ref);
  }
  ctx.setSelectedKeyframes(ctx.state.selectedKeyframes, options);
}

function prepareKeyframeSelectionForPointer(
  ctx: ViewerAppContext,
  event: SelectionModifiers,
  trackId: string,
  keyframeId: string,
): void {
  const ref = { keyframeId, trackId };
  ctx.clearSelectionCollections("keyframe");
  ctx.setSidebarGroup("inspect");
  if (event.shiftKey || event.metaKey || event.ctrlKey) {
    ctx.toggleKeyframeSelection(ref, { render: false });
  } else {
    if (!ctx.isSelectedKeyframe(trackId, keyframeId)) {
      ctx.setSelectedKeyframes([ref], { render: false });
    } else {
      const selected = ctx.state.selectedKeyframes.filter(
        (item) => item.trackId !== trackId || item.keyframeId !== keyframeId,
      );
      ctx.setSelectedKeyframes([...selected, ref], { render: false });
    }
  }
  syncCanvasSelection(ctx);
}
export function createKeyframeSelectionActions(
  getContext: () => ViewerAppContext,
) {
  return {
    selectKeyframe: bindViewerAction(selectKeyframe, getContext),
    isSelectedKeyframe: bindViewerAction(isSelectedKeyframe, getContext),
    setSelectedKeyframes: bindViewerAction(setSelectedKeyframes, getContext),
    toggleKeyframeSelection: bindViewerAction(
      toggleKeyframeSelection,
      getContext,
    ),
    prepareKeyframeSelectionForPointer: bindViewerAction(
      prepareKeyframeSelectionForPointer,
      getContext,
    ),
  };
}
