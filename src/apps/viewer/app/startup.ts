import type { ViewerAppContext } from "./context.js";
import { wireEditorDraftEvents } from "../editor/draft-events.js";

export function wireViewerStartup(ctx: ViewerAppContext): void {
  ctx.refs.playButton.disabled = true;
  ctx.initializeTheme();
  ctx.initializePlaybackCachePreference?.();
  ctx.renderLocalizedShell();
  ctx.syncLocaleMenuOptions();
  ctx.wireTemplateCombobox();
  ctx.wirePreviewMediaSession?.();
  ctx.wireTimelineLayerSearch();
  ctx.setSidebarGroup(ctx.state.activeSidebarGroup);
  ctx.observeCanvasSelectionViewport();
  ctx.observeTimelineContentMetrics();
  document.addEventListener(
    "keydown",
    (event) => ctx.handleGlobalSpaceKeydown(event),
    { capture: true },
  );
  document.addEventListener("keydown", (event) =>
    ctx.handleGlobalKeydown(event),
  );
  document.addEventListener("click", (event) => {
    if (
      ctx.state.actionsMenuOpen &&
      event.target instanceof Element &&
      !event.target.closest(".app-actions")
    ) {
      ctx.setActionsMenuOpen(false);
    }
  });
  window.addEventListener("message", (event) => {
    if (event.source === ctx.refs.sandboxFrame.contentWindow) {
      ctx.handleSandboxMessage(event.data);
    }
  });
  ctx.refs.sandboxFrame.addEventListener("load", () => {
    ctx.logDiagnostic("Sandbox iframe loaded.", "ok");
  });
  ctx.refs.sandboxFrame.src = ctx.createSandboxUrl();
  ctx.refs.templateSelect.addEventListener("change", () => {
    void ctx.selectTemplate(ctx.refs.templateSelect.value);
    ctx.refs.templateSelect.blur();
  });
  ctx.refs.localeSelect.addEventListener("change", () => {
    ctx.deps.setLocale(ctx.refs.localeSelect.value);
    ctx.renderLocalizedShell();
    const localizedTime = ctx.formatSeconds(ctx.refs.timeSlider.value);
    ctx.refs.timeOutput.textContent = localizedTime;
    if (ctx.refs.fullscreenTimeOutput) {
      ctx.refs.fullscreenTimeOutput.textContent = localizedTime;
    }
    ctx.syncPreviewQualityBadge(ctx.state.appliedPreviewScale);
    ctx.syncLocaleMenuOptions();
    if (ctx.state.currentTemplate) {
      ctx.populateTemplates(ctx.state.templates);
      ctx.refs.templateSelect.value = ctx.state.currentTemplate.id;
      ctx.syncTemplateCombobox();
      ctx.updateTemplateContext(ctx.state.currentTemplate);
      ctx.renderControls(ctx.state.currentTemplate);
      ctx.renderPresetsPanel(ctx.state.currentTemplate);
      ctx.renderTimelineEditor(ctx.state.currentTemplate);
      ctx.renderInspector();
    }
  });
  ctx.refs.timeSlider.addEventListener("input", () => {
    ctx.pausePlayback({
      preservePreparation: true,
      renderCurrentFrame: false,
    });
    if (ctx.refs.fullscreenTimeSlider) {
      ctx.refs.fullscreenTimeSlider.value = ctx.refs.timeSlider.value;
    }
    ctx.updateTimelinePlayhead();
    void ctx.renderCurrentFrame({ interactive: true });
  });
  ctx.refs.timeSlider.addEventListener("change", () => {
    if (!ctx.state.playing) {
      void ctx.refinePreviewAtFullQuality();
    }
  });
  ctx.refs.fullscreenTimeSlider?.addEventListener("input", () => {
    ctx.pausePlayback({
      preservePreparation: true,
      renderCurrentFrame: false,
    });
    ctx.refs.timeSlider.value = ctx.refs.fullscreenTimeSlider.value;
    ctx.updateTimelinePlayhead();
    void ctx.renderCurrentFrame({ interactive: true });
  });
  ctx.refs.fullscreenTimeSlider?.addEventListener("change", () => {
    if (!ctx.state.playing) {
      void ctx.refinePreviewAtFullQuality();
    }
  });
  ctx.refs.fpsInput.addEventListener(
    "change",
    () => void ctx.renderCurrentFrame(),
  );
  ctx.refs.durationInput.addEventListener("change", () =>
    ctx.setCurrentDuration(Number(ctx.refs.durationInput.value)),
  );
  ctx.refs.snapModeSelect.addEventListener("change", () => {
    ctx.state.snapMode = ctx.refs.snapModeSelect.value;
  });
  ctx.refs.timelineZoomInput.addEventListener("input", () =>
    ctx.setTimelineZoom(Number(ctx.refs.timelineZoomInput.value)),
  );
  ctx.refs.timelineZoomOutButton.addEventListener("click", () =>
    ctx.setTimelineZoom(ctx.state.timelineZoom / 1.25),
  );
  ctx.refs.timelineZoomInButton.addEventListener("click", () =>
    ctx.setTimelineZoom(ctx.state.timelineZoom * 1.25),
  );
  ctx.refs.frameSelectionButton.addEventListener("click", () =>
    ctx.frameSelectedTimelineItem(),
  );
  ctx.refs.graphEditorButton.addEventListener("click", () =>
    ctx.toggleGraphEditor(),
  );
  ctx.refs.expandTimelineRowsButton?.addEventListener("click", () =>
    ctx.setAllTimelineRowsExpanded(true),
  );
  ctx.refs.collapseTimelineRowsButton?.addEventListener("click", () =>
    ctx.setAllTimelineRowsExpanded(false),
  );
  ctx.refs.themeToggleButton?.addEventListener("click", () =>
    ctx.toggleTheme(),
  );
  ctx.refs.appActionsButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    ctx.toggleActionsMenu();
  });
  ctx.refs.appActionsButton
    ?.closest(".app-actions")
    ?.addEventListener("keydown", (event) =>
      ctx.handleActionsMenuKeydown(event),
    );
  ctx.refs.localeMenuOptions.forEach((button) => {
    button.addEventListener("click", () =>
      ctx.selectLocaleMenuOption(button.dataset.localeOption),
    );
  });
  ctx.refs.appActionsMenu?.addEventListener("click", (event) => {
    const menuButton =
      event.target instanceof Element ? event.target.closest("button") : null;
    if (menuButton) {
      ctx.setActionsMenuOpen(false);
      window.requestAnimationFrame(() => {
        const dialogOpen = Boolean(
          ctx.refs.mp4ExportDialog?.open || ctx.refs.resetDraftDialog?.open,
        );
        if (!dialogOpen && document.activeElement === menuButton) {
          ctx.refs.appActionsButton?.focus();
        }
      });
    }
  });
  ctx.refs.importEffectFileButton.addEventListener("click", () => {
    ctx.refs.effectFileInput.click();
  });
  ctx.refs.effectFileInput.addEventListener(
    "change",
    () => void ctx.importSelectedEffectFile(),
  );
  ctx.wireEffectFileJsonBindingActions();
  ctx.refs.exportEffectFileButton.addEventListener("click", () =>
    ctx.exportCurrentEffectFile(),
  );
  ctx.refs.copyDiagnosticsButton?.addEventListener(
    "click",
    () => void ctx.copyDiagnostics(),
  );
  ctx.refs.exportMp4Button.addEventListener(
    "click",
    () => void ctx.openMp4ExportDialog(),
  );
  ctx.refs.mp4ExportCloseButton.addEventListener("click", () =>
    ctx.closeMp4ExportDialog(),
  );
  ctx.refs.mp4ExportCancelButton.addEventListener("click", () =>
    ctx.closeMp4ExportDialog(),
  );
  ctx.refs.mp4ExportDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    ctx.closeMp4ExportDialog();
  });
  ctx.refs.mp4ExportForm.addEventListener(
    "submit",
    (event) => void ctx.startMp4Export(event),
  );
  ctx.refs.mp4ExportSizeSelect.addEventListener(
    "change",
    () => void ctx.updateMp4ExportSize(),
  );
  ctx.refs.mp4ExportFpsInput.addEventListener(
    "input",
    () => void ctx.updateMp4ExportCustomSize(),
  );
  ctx.refs.mp4ExportWidthInput.addEventListener(
    "input",
    () => void ctx.updateMp4ExportCustomSize(),
  );
  ctx.refs.mp4ExportHeightInput.addEventListener(
    "input",
    () => void ctx.updateMp4ExportCustomSize(),
  );
  ctx.refs.fullscreenPreviewButton.addEventListener(
    "click",
    () => void ctx.togglePreviewFullscreen(),
  );
  ctx.refs.fullscreenPlayButton?.addEventListener("click", () =>
    ctx.togglePlayback(),
  );
  ctx.refs.layoutResizer.addEventListener("mousedown", (event) =>
    ctx.beginLayoutResize(event),
  );
  ctx.refs.layoutResizer.addEventListener("keydown", (event) =>
    ctx.handleLayoutResizerKeydown(event),
  );
  ctx.refs.layoutResizer.addEventListener("dblclick", () =>
    ctx.setTimelineEditorHeight(330),
  );
  ctx.refs.previewZoomButtons.forEach((button) => {
    button.addEventListener("click", () =>
      ctx.setPreviewZoom(button.dataset.previewZoom || "fit"),
    );
  });
  ctx.refs.previewGuidesButton.addEventListener("click", () =>
    ctx.setPreviewGuides(!ctx.state.previewGuides),
  );
  ctx.refs.previewSnapButton.addEventListener("click", () =>
    ctx.setPreviewSnap(!ctx.state.previewSnap),
  );
  ctx.refs.sidebarCollapseButton.addEventListener("click", () =>
    ctx.setSidebarCollapsed(!ctx.state.sidebarCollapsed),
  );
  ctx.refs.sidebarWidthResizer.addEventListener("mousedown", (event) =>
    ctx.beginSidebarWidthResize(event),
  );
  ctx.refs.sidebarWidthResizer.addEventListener("keydown", (event) =>
    ctx.handleSidebarWidthResizerKeydown(event),
  );
  ctx.refs.sidebarWidthResizer.addEventListener("dblclick", () =>
    ctx.setSidebarWidth(ctx.deps.DEFAULT_SIDEBAR_WIDTH),
  );
  ctx.refs.timelineRuler.addEventListener("wheel", ctx.handleTimelineWheel, {
    passive: false,
  });
  ctx.refs.timelineTracks.addEventListener("wheel", ctx.handleTimelineWheel, {
    passive: false,
  });
  ctx.refs.timelineTracks.addEventListener("scroll", () =>
    ctx.handleTimelineTracksScroll(),
  );
  ctx.refs.sizeSelect.addEventListener("change", () => {
    ctx.applyPreviewRasterSize();
    void ctx.renderCurrentFrame();
  });
  ctx.refs.playButton.addEventListener("click", () => ctx.togglePlayback());
  wireEditorDraftEvents(ctx);
  ctx.refs.previewLiveModeButton.addEventListener("click", () =>
    ctx.setPlaybackCacheEnabled(false),
  );
  ctx.refs.previewCacheButton.addEventListener("click", () =>
    ctx.setPlaybackCacheEnabled(true),
  );
  ctx.refs.loopButton.addEventListener("click", () => ctx.toggleLoopPlayback());
  ctx.refs.savePresetButton.addEventListener("click", () =>
    ctx.saveCurrentAsPreset(),
  );
  ctx.refs.duplicatePresetButton.addEventListener("click", () =>
    ctx.duplicateSelectedPreset(),
  );
  ctx.refs.replaceAssetInput.addEventListener(
    "change",
    () => void ctx.replaceSelectedAssetFile(),
  );
  ctx.refs.canvas.addEventListener("pointerdown", (event) =>
    ctx.beginCanvasHitTestPointerDown(event),
  );
  ctx.refs.canvas.addEventListener("dblclick", (event) =>
    ctx.handleCanvasDoubleClick(event),
  );
  ctx.refs.canvasSelectionBox.addEventListener("pointerdown", (event) =>
    ctx.beginCanvasSelectionPointerDown(event),
  );
  ctx.refs.canvasSelectionBox.addEventListener("dblclick", (event) =>
    ctx.handleCanvasDoubleClick(event),
  );
  ctx.refs.motionPathOverlay.addEventListener("pointerdown", (event) =>
    ctx.beginMotionPathPointHitDrag(event),
  );
  void ctx.bootstrap();
}

export function installAppStartupOwner(ctx: ViewerAppContext): void {
  ctx.wireViewerStartup = wireViewerStartup.bind(undefined, ctx);
}
