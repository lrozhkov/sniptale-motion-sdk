import type { ViewerAppContext } from "./context.js";

const TEXT_ENTRY_INPUT_TYPES = new Set([
  "email",
  "password",
  "search",
  "tel",
  "text",
  "url",
]);

function handleGlobalSpaceKeydown(ctx: ViewerAppContext, event) {
  if (
    event.code !== "Space" ||
    ctx.isTextEntryControl(event.target) ||
    ctx.hasOpenDropdownMenu() ||
    Boolean(document.querySelector("dialog[open]"))
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (!event.repeat && !ctx.refs.playButton.disabled) {
    ctx.togglePlayback();
  }
}
function hasOpenDropdownMenu(ctx: ViewerAppContext) {
  let nativeSelectOpen = false;
  try {
    nativeSelectOpen = Boolean(document.querySelector("select:open"));
  } catch {}
  return Boolean(
    nativeSelectOpen ||
    document.querySelector("details.preview-media-menu[open]") ||
    document.querySelector(
      '[role="menu"]:not([hidden]), [role="listbox"]:not([hidden])',
    ),
  );
}

function handleGlobalKeydown(ctx: ViewerAppContext, event) {
  if (
    event.code === "Escape" &&
    (ctx.refs.mp4ExportDialog?.open || ctx.refs.resetDraftDialog?.open)
  ) {
    return;
  }
  const primaryModifier = event.metaKey || event.ctrlKey;
  if (primaryModifier && event.code === "KeyS") {
    event.preventDefault();
    void ctx.saveEditorDraftNow({ manual: true });
    return;
  }
  if (ctx.isEditingFormControl(event.target)) {
    return;
  }
  if (primaryModifier && event.code === "KeyF") {
    event.preventDefault();
    ctx.openTimelineLayerSearch();
    return;
  }
  if (
    primaryModifier &&
    (event.code === "KeyY" || (event.code === "KeyZ" && event.shiftKey))
  ) {
    event.preventDefault();
    void ctx.redoEditorEdit();
    return;
  }
  if (primaryModifier && event.code === "KeyZ") {
    event.preventDefault();
    void ctx.undoEditorEdit();
    return;
  }
  if (primaryModifier && event.code === "KeyG") {
    event.preventDefault();
    if (event.shiftKey) {
      ctx.ungroupSelectedLayers();
    } else {
      ctx.groupSelectedLayers();
    }
    return;
  }
  if (primaryModifier && event.code === "KeyC") {
    if (hasNativeCopySelection()) {
      return;
    }
    if (ctx.copySelectedKeyframes()) {
      event.preventDefault();
    }
    return;
  }
  if (primaryModifier && event.code === "KeyV") {
    event.preventDefault();
    ctx.pasteKeyframesAtPlayhead();
    return;
  }
  if (primaryModifier && event.code === "KeyD") {
    event.preventDefault();
    if (ctx.state.selectedItem?.type === "layer") {
      ctx.duplicateSelectedLayer();
    } else {
      ctx.duplicateSelectedKeyframes();
    }
    return;
  }
  if (
    primaryModifier &&
    (event.code === "ArrowUp" || event.code === "ArrowDown")
  ) {
    event.preventDefault();
    ctx.moveSelectedLayerOrder(event.code === "ArrowUp" ? 1 : -1);
    return;
  }
  if (primaryModifier && event.code === "KeyB") {
    event.preventDefault();
    ctx.setSidebarCollapsed(!ctx.state.sidebarCollapsed);
    return;
  }
  if (event.code === "Delete" || event.code === "Backspace") {
    event.preventDefault();
    ctx.deleteSelectedTimelineItem();
    return;
  }
  if (event.code === "Escape") {
    event.preventDefault();
    if (ctx.refs.previewMediaMenu?.open) {
      ctx.refs.previewMediaMenu.open = false;
      ctx.refs.previewMediaButton?.focus();
      return;
    }
    if (ctx.state.actionsMenuOpen) {
      ctx.setActionsMenuOpen(false);
      ctx.refs.appActionsButton?.focus();
      return;
    }
    if (ctx.refs.stageWrap.classList.contains("preview-fullscreen")) {
      ctx.refs.stageWrap.classList.remove("preview-fullscreen");
      ctx.syncFullscreenButton();
      return;
    }
    if (ctx.exitCanvasGroupIsolation()) {
      return;
    }
    ctx.clearSelection();
    return;
  }
  if (event.code === "Enter" && ctx.enterSelectedCanvasGroup()) {
    event.preventDefault();
    return;
  }
  if (
    event.code === "Enter" &&
    ctx.shouldFocusInspectorFromEnter(event.target)
  ) {
    event.preventDefault();
    ctx.focusInspectorForSelection();
    return;
  }
  if (event.code === "KeyF") {
    event.preventDefault();
    ctx.frameSelectedTimelineItem();
    return;
  }
  if (event.code === "KeyK") {
    event.preventDefault();
    ctx.addKeyframeAtPlayheadForSelection();
    return;
  }
  if (event.code === "BracketLeft" || event.code === "BracketRight") {
    event.preventDefault();
    ctx.navigateSelectedKeyframe(event.code === "BracketLeft" ? -1 : 1, {
      extend: event.shiftKey,
    });
    return;
  }
  if (event.code === "Home") {
    event.preventDefault();
    ctx.seekToTime(0);
    return;
  }
  if (event.code === "End") {
    event.preventDefault();
    ctx.seekToTime(ctx.getEffectiveDuration());
    return;
  }
  if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
    event.preventDefault();
    if (ctx.state.selectedItem?.type === "layer") {
      const direction = event.code === "ArrowLeft" ? -1 : 1;
      const amount = event.altKey ? 0.1 : event.shiftKey ? 10 : 1;
      ctx.nudgeSelectedLayer(direction * amount, 0);
      return;
    }
    if (ctx.state.selectedItem?.type === "keyframe" && event.altKey) {
      const direction = event.code === "ArrowLeft" ? -1 : 1;
      ctx.nudgeSelectedKeyframesByFrames(direction, event.shiftKey ? 10 : 1);
      return;
    }
    const fps = Math.max(1, Number(ctx.refs.fpsInput.value) || 30);
    const frames = event.shiftKey ? 10 : 1;
    const direction = event.code === "ArrowLeft" ? -1 : 1;
    ctx.seekToTime(
      (Number(ctx.refs.timeSlider.value) || 0) + (direction * frames) / fps,
    );
    return;
  }
  if (
    (event.code === "ArrowUp" || event.code === "ArrowDown") &&
    ctx.state.selectedItem?.type === "layer"
  ) {
    event.preventDefault();
    const direction = event.code === "ArrowUp" ? -1 : 1;
    const amount = event.altKey ? 0.1 : event.shiftKey ? 10 : 1;
    ctx.nudgeSelectedLayer(0, direction * amount);
  }
}

export function hasNativeCopySelection(
  selection: Selection | null = typeof window === "undefined"
    ? null
    : window.getSelection(),
): boolean {
  return Boolean(selection && !selection.isCollapsed && selection.toString());
}
function isEditingFormControl(ctx: ViewerAppContext, target) {
  const element = target instanceof Element ? target : null;
  if (!element) {
    return false;
  }
  return Boolean(
    element.closest('input, textarea, select, [contenteditable="true"]'),
  );
}
function isTextEntryControl(ctx: ViewerAppContext, target) {
  const element = target instanceof Element ? target : null;
  const editable = element?.closest("input, textarea, [contenteditable]");
  if (editable instanceof HTMLInputElement) {
    return TEXT_ENTRY_INPUT_TYPES.has(editable.type);
  }
  if (editable instanceof HTMLTextAreaElement) {
    return true;
  }
  return editable instanceof HTMLElement && editable.isContentEditable;
}
function isButtonLikeControl(ctx: ViewerAppContext, target) {
  const element = target instanceof Element ? target : null;
  return Boolean(element?.closest("button, a, summary"));
}
function shouldFocusInspectorFromEnter(ctx: ViewerAppContext, target) {
  const element = target instanceof Element ? target : null;
  return (
    !ctx.isButtonLikeControl(target) ||
    Boolean(element?.closest("#timelineTracks, #timelineRuler"))
  );
}

export function installAppKeyboardOwner(ctx: ViewerAppContext): void {
  ctx.handleGlobalSpaceKeydown = (...args: any[]) =>
    (handleGlobalSpaceKeydown as any)(ctx, ...args);
  ctx.handleGlobalKeydown = (...args: any[]) =>
    (handleGlobalKeydown as any)(ctx, ...args);
  ctx.hasOpenDropdownMenu = (...args: any[]) =>
    (hasOpenDropdownMenu as any)(ctx, ...args);
  ctx.isEditingFormControl = (...args: any[]) =>
    (isEditingFormControl as any)(ctx, ...args);
  ctx.isTextEntryControl = (...args: any[]) =>
    (isTextEntryControl as any)(ctx, ...args);
  ctx.isButtonLikeControl = (...args: any[]) =>
    (isButtonLikeControl as any)(ctx, ...args);
  ctx.shouldFocusInspectorFromEnter = (...args: any[]) =>
    (shouldFocusInspectorFromEnter as any)(ctx, ...args);
}
