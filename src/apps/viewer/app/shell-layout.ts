import { bindViewerAction } from "./bind-action.js";
import type { ShellLayoutActions } from "./shell-contract.js";
import type { ViewerAppContext } from "./context.js";

function setSidebarCollapsed(ctx: ViewerAppContext, collapsed: boolean) {
  const focusWasInside = ctx.refs.sidebar.contains(document.activeElement);
  ctx.state.sidebarCollapsed = Boolean(collapsed);
  ctx.refs.appShell.classList.toggle(
    "sidebar-collapsed",
    ctx.state.sidebarCollapsed,
  );
  ctx.refs.sidebar.hidden = ctx.state.sidebarCollapsed;
  ctx.refs.sidebarWidthResizer.hidden = ctx.state.sidebarCollapsed;
  const label = ctx.state.sidebarCollapsed
    ? ctx.deps.t("viewer.sidebar.showPanel", "Show panel")
    : ctx.deps.t("viewer.sidebar.hidePanel", "Hide panel");
  ctx.setIconButton(
    ctx.refs.sidebarCollapseButton,
    ctx.state.sidebarCollapsed ? "panelRightOpen" : "panelRightClose",
    label,
  );
  ctx.refs.sidebarCollapseButton.title = ctx.deps.t(
    ctx.state.sidebarCollapsed
      ? "viewer.sidebar.showPanelShortcut"
      : "viewer.sidebar.hidePanelShortcut",
    ctx.state.sidebarCollapsed ? "Show panel (Ctrl+B)" : "Hide panel (Ctrl+B)",
  );
  ctx.refs.sidebarCollapseButton.setAttribute(
    "aria-expanded",
    String(!ctx.state.sidebarCollapsed),
  );
  ctx.refs.sidebarCollapseButton.setAttribute("aria-label", label);
  if (ctx.state.sidebarCollapsed && focusWasInside) {
    ctx.refs.sidebarCollapseButton.focus({ preventScroll: true });
  }
  ctx.updateCanvasSelectionBox();
}

function setSidebarWidth(ctx: ViewerAppContext, width: number) {
  const shellWidth =
    ctx.refs.appShell.getBoundingClientRect().width || window.innerWidth;
  const maxWidth = Math.max(320, Math.min(560, shellWidth - 760));
  const nextWidth = ctx.deps.clamp(
    width || ctx.deps.DEFAULT_SIDEBAR_WIDTH,
    280,
    maxWidth,
  );
  ctx.state.sidebarWidth = nextWidth;
  document.documentElement.style.setProperty(
    "--sidebar-width",
    `${Math.round(nextWidth)}px`,
  );
  ctx.refs.sidebarWidthResizer.setAttribute("aria-valuemin", "280");
  ctx.refs.sidebarWidthResizer.setAttribute(
    "aria-valuemax",
    String(Math.round(maxWidth)),
  );
  ctx.refs.sidebarWidthResizer.setAttribute(
    "aria-valuenow",
    String(Math.round(nextWidth)),
  );
  ctx.updateCanvasSelectionBox();
}

function setTimelineEditorHeight(ctx: ViewerAppContext, height: number) {
  const shellHeight =
    ctx.refs.stageWrap.closest(".viewer")?.getBoundingClientRect().height ??
    window.innerHeight;
  const maxHeight = Math.max(240, Math.min(560, shellHeight - 260));
  const nextHeight = ctx.deps.clamp(height || 330, 220, maxHeight);
  ctx.state.timelineEditorHeight = nextHeight;
  ctx.state.timelineTrackOverlayHeight = null;
  document.documentElement.style.setProperty(
    "--timeline-editor-height",
    `${Math.round(nextHeight)}px`,
  );
  ctx.refs.layoutResizer.setAttribute("aria-valuemin", "220");
  ctx.refs.layoutResizer.setAttribute(
    "aria-valuemax",
    String(Math.round(maxHeight)),
  );
  ctx.refs.layoutResizer.setAttribute(
    "aria-valuenow",
    String(Math.round(nextHeight)),
  );
  scheduleTimelineOverlaySync(ctx);
}

function scheduleTimelineOverlaySync(ctx: ViewerAppContext) {
  if (ctx.timelineOverlaySyncFrame) {
    return;
  }
  ctx.timelineOverlaySyncFrame = requestAnimationFrame(() => {
    ctx.timelineOverlaySyncFrame = 0;
    ctx.state.timelineTrackOverlayHeight = null;
    if (ctx.state.currentTemplate) {
      ctx.updateTimelineTrackOverlayHeights();
    }
  });
}

function setPreviewZoom(ctx: ViewerAppContext, zoom: unknown) {
  const nextZoom = zoom === "75" || zoom === "100" ? zoom : "fit";
  ctx.state.previewZoom = nextZoom;
  ctx.refs.stageFrame.dataset.previewZoom = nextZoom;
  ctx.refs.stageWrap.classList.toggle("preview-scroll", nextZoom !== "fit");
  if (nextZoom === "fit") {
    ctx.refs.stageFrame.style.width = "";
    ctx.refs.stageWrap.scrollLeft = 0;
    ctx.refs.stageWrap.scrollTop = 0;
  } else {
    const scale = Number(nextZoom) / 100;
    ctx.refs.stageFrame.style.width = `${Math.round(ctx.refs.canvas.width * scale)}px`;
  }
  ctx.refs.previewZoomButtons.forEach((button) => {
    const active = button.dataset.previewZoom === nextZoom;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  ctx.updateCanvasSelectionBox();
}

function setPreviewGuides(ctx: ViewerAppContext, enabled: boolean) {
  ctx.state.previewGuides = Boolean(enabled);
  ctx.refs.previewGuides.hidden = !ctx.state.previewGuides;
  ctx.refs.previewGuidesButton.classList.toggle(
    "active",
    ctx.state.previewGuides,
  );
  ctx.refs.previewGuidesButton.setAttribute(
    "aria-pressed",
    String(ctx.state.previewGuides),
  );
}

function setPreviewSnap(ctx: ViewerAppContext, enabled: boolean) {
  ctx.state.previewSnap = Boolean(enabled);
  if (!ctx.state.previewSnap) {
    ctx.state.canvasSnapStatus = null;
  }
  ctx.refs.previewSnapButton.classList.toggle("active", ctx.state.previewSnap);
  ctx.refs.previewSnapButton.setAttribute(
    "aria-pressed",
    String(ctx.state.previewSnap),
  );
  if (ctx.state.previewSnap && !ctx.state.previewGuides) {
    ctx.setPreviewGuides(true);
  }
}

function beginSidebarWidthResize(ctx: ViewerAppContext, event: MouseEvent) {
  if (event.button !== 0 || ctx.state.sidebarCollapsed) {
    return;
  }
  event.preventDefault();
  const startX = event.clientX;
  const startWidth = ctx.state.sidebarWidth;
  const onMove = (moveEvent: MouseEvent) => {
    ctx.state.dragMoved =
      ctx.state.dragMoved || Math.abs(moveEvent.clientX - startX) > 2;
    ctx.setSidebarWidth(startWidth - (moveEvent.clientX - startX));
  };
  ctx.bindPointerDrag(
    "pointerId" in event && typeof event.pointerId === "number"
      ? event.pointerId
      : undefined,
    ctx.refs.sidebarWidthResizer,
    onMove,
  );
}

function handleSidebarWidthResizerKeydown(
  ctx: ViewerAppContext,
  event: KeyboardEvent,
) {
  if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") {
    return;
  }
  event.preventDefault();
  const step = event.shiftKey ? 48 : 16;
  ctx.setSidebarWidth(
    ctx.state.sidebarWidth + (event.code === "ArrowLeft" ? step : -step),
  );
}

function beginLayoutResize(ctx: ViewerAppContext, event: MouseEvent) {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  const startY = event.clientY;
  const startHeight = ctx.state.timelineEditorHeight;
  const onMove = (moveEvent: MouseEvent) => {
    ctx.state.dragMoved =
      ctx.state.dragMoved || Math.abs(moveEvent.clientY - startY) > 2;
    ctx.setTimelineEditorHeight(startHeight - (moveEvent.clientY - startY));
    ctx.updateCanvasSelectionBox();
  };
  ctx.bindPointerDrag(
    "pointerId" in event && typeof event.pointerId === "number"
      ? event.pointerId
      : undefined,
    ctx.refs.layoutResizer,
    onMove,
  );
}

function handleLayoutResizerKeydown(
  ctx: ViewerAppContext,
  event: KeyboardEvent,
) {
  if (event.code !== "ArrowUp" && event.code !== "ArrowDown") {
    return;
  }
  event.preventDefault();
  const step = event.shiftKey ? 48 : 16;
  ctx.setTimelineEditorHeight(
    ctx.state.timelineEditorHeight + (event.code === "ArrowUp" ? step : -step),
  );
  ctx.updateCanvasSelectionBox();
}

async function togglePreviewFullscreen(ctx: ViewerAppContext) {
  const active = isPreviewFullscreenActive(ctx);
  if (active) {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
    ctx.refs.stageWrap.classList.remove("preview-fullscreen");
    ctx.syncFullscreenButton();
    return;
  }
  if (ctx.refs.stageWrap.requestFullscreen) {
    try {
      await ctx.refs.stageWrap.requestFullscreen();
    } catch {
      ctx.refs.stageWrap.classList.add("preview-fullscreen");
    }
  } else {
    ctx.refs.stageWrap.classList.add("preview-fullscreen");
  }
  ctx.syncFullscreenButton();
}

function syncFullscreenButton(ctx: ViewerAppContext) {
  const active = isPreviewFullscreenActive(ctx);
  ctx.setIconButton(
    ctx.refs.fullscreenPreviewButton,
    active ? "minimize" : "maximize",
    active
      ? ctx.deps.t("viewer.preview.exitFullscreen", "Exit fullscreen preview")
      : ctx.deps.t("viewer.preview.openFullscreen", "Open fullscreen preview"),
  );
}

export function isPreviewFullscreenActive(ctx: ViewerAppContext): boolean {
  return (
    document.fullscreenElement === ctx.refs.stageWrap ||
    ctx.refs.stageWrap.classList.contains("preview-fullscreen")
  );
}

export function createShellLayoutActions(
  getContext: () => ViewerAppContext,
): ShellLayoutActions {
  return {
    setSidebarCollapsed: bindViewerAction(setSidebarCollapsed, getContext),
    setSidebarWidth: bindViewerAction(setSidebarWidth, getContext),
    setTimelineEditorHeight: bindViewerAction(
      setTimelineEditorHeight,
      getContext,
    ),
    setPreviewZoom: bindViewerAction(setPreviewZoom, getContext),
    setPreviewGuides: bindViewerAction(setPreviewGuides, getContext),
    setPreviewSnap: bindViewerAction(setPreviewSnap, getContext),
    beginSidebarWidthResize: bindViewerAction(
      beginSidebarWidthResize,
      getContext,
    ),
    handleSidebarWidthResizerKeydown: bindViewerAction(
      handleSidebarWidthResizerKeydown,
      getContext,
    ),
    beginLayoutResize: bindViewerAction(beginLayoutResize, getContext),
    handleLayoutResizerKeydown: bindViewerAction(
      handleLayoutResizerKeydown,
      getContext,
    ),
    togglePreviewFullscreen: bindViewerAction(
      togglePreviewFullscreen,
      getContext,
    ),
    syncFullscreenButton: bindViewerAction(syncFullscreenButton, getContext),
    isPreviewFullscreenActive: bindViewerAction(
      isPreviewFullscreenActive,
      getContext,
    ),
  };
}
