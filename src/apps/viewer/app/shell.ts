import { isViewerIconName } from "./icons.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";
import { bindViewerAction } from "./bind-action.js";
import type { ShellActions } from "./shell-contract.js";
import type { ViewerAppContext } from "./context.js";
import {
  isPlaybackPreparationPhase,
  syncPlaybackRunState,
} from "../playback/run-state.js";

function localizeShellNodes(ctx: ViewerAppContext) {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    if (!(element instanceof HTMLElement)) return;
    const key = element.dataset.i18n;
    if (!key || element.dataset.shellIcon) {
      return;
    }
    element.textContent = ctx.deps.t(
      key,
      element.dataset.i18nFallback ?? element.textContent ?? key,
    );
  });
  document
    .querySelectorAll("[data-shell-icon][data-i18n]")
    .forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const key = button.dataset.i18n;
      const icon = button.dataset.shellIcon;
      if (!key || !isViewerIconName(icon)) {
        return;
      }
      ctx.setIconButton(
        button,
        icon,
        ctx.deps.t(key, button.dataset.i18nFallback ?? key),
        { showText: true },
      );
    });
  const localizedAttributes = [
    ["aria-label", "i18nAriaLabel"],
    ["placeholder", "i18nPlaceholder"],
    ["title", "i18nTitle"],
  ] as const;
  for (const [attribute, datasetKey] of localizedAttributes) {
    document
      .querySelectorAll(
        `[data-${datasetKey.replace(
          /[A-Z]/g,
          (letter) => `-${letter.toLowerCase()}`,
        )}]`,
      )
      .forEach((element) => {
        if (!(element instanceof HTMLElement)) return;
        const key = element.dataset[datasetKey];
        if (!key) {
          return;
        }
        element.setAttribute(
          attribute,
          ctx.deps.t(key, element.getAttribute(attribute) ?? key),
        );
      });
  }
}

function renderLocalizedShell(ctx: ViewerAppContext) {
  document.documentElement.lang = ctx.deps.getLocale();
  localizeShellNodes(ctx);
  const title = document.querySelector("h1");
  if (title)
    title.textContent = ctx.deps.t("viewer.appTitle", "Sniptale Motion SDK");
  ctx.syncPlaybackButtons();
  ctx.syncPlaybackCacheButton?.();
  ctx.syncPreviewMediaUi?.();
  ctx.setIconButton(
    ctx.refs.appActionsButton,
    "menu",
    ctx.deps.t("viewer.menu.fileActions", "File actions"),
  );
  ctx.setIconButton(
    ctx.refs.mp4ExportCloseButton,
    "x",
    ctx.deps.t("viewer.mp4Export.close", "Close MP4 export"),
  );
  ctx.localizeMp4ExportDialog?.();
  ctx.setIconButton(
    ctx.refs.timelineZoomOutButton,
    "zoomOut",
    ctx.deps.t("viewer.timeline.zoomOut", "Zoom out"),
  );
  ctx.setIconButton(
    ctx.refs.timelineZoomInButton,
    "zoomIn",
    ctx.deps.t("viewer.timeline.zoomIn", "Zoom in"),
  );
  ctx.setIconButton(
    ctx.refs.frameSelectionButton,
    "focus",
    ctx.deps.t("viewer.timeline.frameSelection", "Frame selection"),
  );
  ctx.refs.frameSelectionButton.title = ctx.deps.t(
    "viewer.timeline.frameSelectionShortcut",
    "Frame selection (F)",
  );
  ctx.setIconButton(
    ctx.refs.timelineLayerSearchButton,
    "search",
    ctx.deps.t("viewer.timeline.searchLayers", "Search layers"),
  );
  ctx.refs.timelineLayerSearchButton.title = ctx.deps.t(
    "viewer.timeline.searchLayersShortcut",
    "Search layers (Ctrl+F)",
  );
  ctx.setIconButton(
    ctx.refs.graphEditorButton,
    "graph",
    ctx.deps.t("viewer.graphEditor.toggle", "Toggle graph editor"),
  );
  ctx.setIconButton(
    ctx.refs.expandTimelineRowsButton,
    "expandAll",
    ctx.deps.t("viewer.timeline.expandAll", "Expand all timeline rows"),
  );
  ctx.setIconButton(
    ctx.refs.collapseTimelineRowsButton,
    "collapseAll",
    ctx.deps.t("viewer.timeline.collapseAll", "Collapse all timeline rows"),
  );
  ctx.setIconButton(
    ctx.refs.saveDraftButton,
    "save",
    ctx.deps.t("viewer.editor.saveDraft", "Save local draft"),
  );
  ctx.setIconButton(
    ctx.refs.undoEditorButton,
    "undo",
    ctx.deps.t("viewer.editor.undo", "Undo"),
  );
  ctx.setIconButton(
    ctx.refs.redoEditorButton,
    "redo",
    ctx.deps.t("viewer.editor.redo", "Redo"),
  );
  ctx.syncEditorWorkflowUi?.();
  ctx.renderTimelineLayerSearch?.();
  ctx.renderCanvasIsolationBreadcrumb?.();
  ctx.syncFullscreenButton();
  ctx.syncThemeButton();
  ctx.setSidebarCollapsed(ctx.state.sidebarCollapsed);
  ctx.syncSidebarHeading();
}
function syncPlaybackButtons(ctx: ViewerAppContext) {
  const phase = syncPlaybackRunState(ctx);
  const preparingPreview = isPlaybackPreparationPhase(phase);
  const recovering = phase === "recovering";
  const label = recovering
    ? ctx.deps.t(
        "viewer.preview.rendererRecovering",
        "Preview renderer is restarting",
      )
    : preparingPreview
      ? ctx.state.playing
        ? ctx.deps.t(
            "viewer.preview.pausePreparation",
            "Pause preview preparation",
          )
        : ctx.deps.t(
            "viewer.preview.resumePreparation",
            "Continue preview preparation",
          )
      : ctx.state.playing
        ? ctx.deps.t("common.actions.pause", "Pause")
        : ctx.deps.t("common.actions.play", "Play");
  const icon = ctx.state.playing ? "pause" : "play";
  const template = ctx.state.currentTemplate;
  const moduleReady =
    !ctx.state.loadedModules ||
    !template?.moduleId ||
    ctx.state.loadedModules.has(template.moduleId);
  const disabled = Boolean(
    recovering || !template || ctx.state.sandboxReady === false || !moduleReady,
  );
  ctx.refs.playButton.disabled = disabled;
  if (ctx.refs.fullscreenPlayButton) {
    ctx.refs.fullscreenPlayButton.disabled = disabled;
  }
  for (const button of [
    ctx.refs.playButton,
    ctx.refs.fullscreenPlayButton,
  ].filter((button): button is HTMLButtonElement => button !== null)) {
    button.setAttribute?.(
      "aria-busy",
      String(recovering || phase === "starting"),
    );
  }
  ctx.setIconButton(ctx.refs.playButton, icon, label);
  ctx.setIconButton(ctx.refs.fullscreenPlayButton, icon, label);
}
function setMoveLinkedKeys(ctx: ViewerAppContext, enabled: boolean) {
  ctx.state.moveLinkedKeys = Boolean(enabled);
  if (ctx.state.currentTemplate) {
    ctx.renderSelectionCrumb(ctx.state.currentTemplate);
    ctx.renderInspector();
  }
}
function createExpandedSceneIdSet(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null = ctx.state.currentTemplate,
) {
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!effectiveTemplate) {
    return new Set<string>();
  }
  return new Set(
    ctx
      .normalizeScenes(
        effectiveTemplate.scenes ?? [],
        effectiveTemplate.duration,
      )
      .map((scene) => scene.id),
  );
}

export function createShellActions(
  getContext: () => ViewerAppContext,
): ShellActions {
  return {
    renderLocalizedShell: bindViewerAction(renderLocalizedShell, getContext),
    syncPlaybackButtons: bindViewerAction(syncPlaybackButtons, getContext),
    setMoveLinkedKeys: bindViewerAction(setMoveLinkedKeys, getContext),
    createExpandedSceneIdSet: bindViewerAction(
      createExpandedSceneIdSet,
      getContext,
    ),
  };
}
