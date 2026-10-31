import { bindViewerAction } from "./bind-action.js";
import type { ShellPanelActions } from "./shell-contract.js";
import type { ViewerSelection } from "../timeline/model/selection-model.js";
import { keyframeRefKey } from "../timeline/model/keyframe-reference.js";
import type { ViewerAppContext } from "./context.js";
import { syncTablistButtons } from "./tablist.js";

const INSPECTOR_TABS_BY_TYPE: Record<
  ViewerSelection["type"],
  readonly string[]
> = {
  asset: ["summary", "ownership"],
  clip: ["summary", "timing", "ownership"],
  effect: ["summary"],
  keyframe: ["summary", "timing", "ownership"],
  layer: ["summary", "transform", "ownership"],
  phase: ["summary", "timing", "ownership"],
  scene: ["summary", "timing", "ownership"],
  track: ["summary", "timing", "ownership"],
};

const DEFAULT_INSPECTOR_TAB_BY_TYPE: Record<ViewerSelection["type"], string> = {
  asset: "summary",
  clip: "timing",
  effect: "summary",
  keyframe: "timing",
  layer: "transform",
  phase: "timing",
  scene: "timing",
  track: "timing",
};

function getInspectorSelectionKey(
  item: ViewerSelection | null | undefined,
  selectedLayers: readonly string[] = [],
): string {
  if (!item || item.type === "effect") return "effect";
  switch (item.type) {
    case "keyframe":
      return `keyframe:${keyframeRefKey(item)}`;
    case "layer":
      return JSON.stringify(["layer", item.layerId, selectedLayers]);
    case "clip":
      return JSON.stringify(["clip", item.layerId]);
    case "scene":
      return JSON.stringify(["scene", item.sceneId]);
    case "phase":
      return JSON.stringify(["phase", item.phaseId]);
    case "track":
      return JSON.stringify(["track", item.trackId]);
    case "asset":
      return JSON.stringify(["asset", item.assetId]);
  }
}

function syncSidebarHeading(ctx: ViewerAppContext) {
  const labels: Record<string, readonly [string, string]> = {
    health: ["viewer.sidebar.review", "Review"],
    inspect: ["viewer.sidebar.inspector", "Inspector"],
    tune: ["viewer.sidebar.effect", "Effect"],
  };
  const [key, fallback] = labels[ctx.state.activeSidebarGroup] ?? [
    "viewer.sidebar.inspector",
    "Inspector",
  ];
  if (ctx.refs.sidebarTitle) {
    ctx.refs.sidebarTitle.textContent = ctx.deps.t(key, fallback);
  }
}

function setSidebarGroup(ctx: ViewerAppContext, group: unknown) {
  const nextGroup =
    group === "tune" || group === "inspect" || group === "health"
      ? group
      : "inspect";
  ctx.state.activeSidebarGroup = nextGroup;
  ctx.refs.sidebar.dataset.activeSidebar = nextGroup;
  syncTablistButtons(ctx.refs.sidebarTabs, nextGroup, "sidebarTab");
  ctx.refs.sidebar.querySelectorAll("[data-sidebar-panel]").forEach((panel) => {
    if (!(panel instanceof HTMLElement)) return;
    panel.hidden = panel.dataset.sidebarPanel !== nextGroup;
  });
  ctx.syncSidebarHeading();
  ctx.syncHealthState();
  if (
    nextGroup === "health" &&
    ctx.state.activeHealthTab === "renderer" &&
    ctx.state.currentTemplate
  ) {
    ctx.renderRendererBindingsPanel(ctx.state.currentTemplate);
  }
}

function setActionsMenuOpen(ctx: ViewerAppContext, open: boolean) {
  ctx.state.actionsMenuOpen = Boolean(open);
  if (ctx.state.actionsMenuOpen) {
    syncLocaleMenuOptions(ctx);
  }
  if (ctx.refs.appActionsMenu) {
    ctx.refs.appActionsMenu.hidden = !ctx.state.actionsMenuOpen;
  }
  ctx.refs.appActionsButton?.setAttribute(
    "aria-expanded",
    String(ctx.state.actionsMenuOpen),
  );
}

function syncLocaleMenuOptions(ctx: ViewerAppContext): void {
  const locale = ctx.refs.localeSelect?.value || "ru";
  ctx.refs.localeMenuOptions.forEach((button) => {
    const selected = button.dataset.localeOption === locale;
    button.setAttribute("aria-checked", String(selected));
  });
}

function selectLocaleMenuOption(ctx: ViewerAppContext, locale: unknown): void {
  if (!ctx.refs.localeSelect || (locale !== "ru" && locale !== "en")) {
    return;
  }
  ctx.refs.localeSelect.value = locale;
  ctx.refs.localeSelect.dispatchEvent(new Event("change", { bubbles: true }));
}

function toggleActionsMenu(ctx: ViewerAppContext) {
  ctx.setActionsMenuOpen(!ctx.state.actionsMenuOpen);
}

function handleActionsMenuKeydown(ctx: ViewerAppContext, event: KeyboardEvent) {
  const trigger = ctx.refs.appActionsButton;
  const menu = ctx.refs.appActionsMenu;
  const items = Array.from(
    menu?.querySelectorAll("button:not(:disabled)") ?? [],
  ).filter(
    (element): element is HTMLButtonElement =>
      element instanceof HTMLButtonElement,
  );
  const activeIndex = items.findIndex(
    (element) => element === document.activeElement,
  );
  if (
    !ctx.state.actionsMenuOpen &&
    event.target === trigger &&
    (event.code === "ArrowDown" || event.code === "ArrowUp")
  ) {
    event.preventDefault();
    event.stopPropagation();
    ctx.setActionsMenuOpen(true);
    items[event.code === "ArrowUp" ? items.length - 1 : 0]?.focus();
    return;
  }
  if (!ctx.state.actionsMenuOpen) {
    return;
  }
  if (event.code === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    ctx.setActionsMenuOpen(false);
    trigger?.focus();
    return;
  }
  const targetIndex =
    event.code === "Home"
      ? 0
      : event.code === "End"
        ? items.length - 1
        : event.code === "ArrowDown"
          ? activeIndex < 0
            ? 0
            : (activeIndex + 1) % items.length
          : event.code === "ArrowUp"
            ? activeIndex < 0
              ? items.length - 1
              : (activeIndex - 1 + items.length) % items.length
            : null;
  if (targetIndex !== null && items.length > 0) {
    event.preventDefault();
    event.stopPropagation();
    items[targetIndex]?.focus();
  }
}

function setInspectorTab(ctx: ViewerAppContext, tab: unknown) {
  const nextTab =
    tab === "summary" ||
    tab === "timing" ||
    tab === "transform" ||
    tab === "ownership"
      ? tab
      : "summary";
  ctx.state.activeInspectorTab = nextTab;
  syncTablistButtons(ctx.refs.inspectorTabs, nextTab, "inspectorTab");
  if (ctx.refs.inspectorPanel) {
    ctx.refs.inspectorPanel.dataset.activeInspectorTab = nextTab;
    ctx.refs.inspectorPanel
      .querySelectorAll("[data-inspector-section]")
      .forEach((panel) => {
        if (!(panel instanceof HTMLElement)) return;
        panel.hidden = panel.dataset.inspectorSection !== nextTab;
      });
  }
  ctx.renderInspector();
}

function syncInspectorTabs(
  ctx: ViewerAppContext,
  item: ViewerSelection = ctx.state.selectedItem ?? { type: "effect" },
) {
  const type = item?.type ?? "effect";
  const available = new Set(
    INSPECTOR_TABS_BY_TYPE[type] ?? INSPECTOR_TABS_BY_TYPE.effect,
  );
  if (item.type === "layer") {
    const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
    const layer = template?.layers?.find((entry) => entry.id === item.layerId);
    const multiSelection = ctx.isLayerSelectionInspector?.(template);
    if (
      !multiSelection &&
      (!layer || ctx.getLayerEditorCapabilities(layer).properties.length === 0)
    ) {
      available.delete("transform");
    }
    if (multiSelection) {
      available.delete("ownership");
    }
  }
  const selectionKey = getInspectorSelectionKey(item, ctx.state.selectedLayers);
  const defaultTab =
    DEFAULT_INSPECTOR_TAB_BY_TYPE[type] ?? DEFAULT_INSPECTOR_TAB_BY_TYPE.effect;
  const availableDefaultTab = available.has(defaultTab)
    ? defaultTab
    : (available.values().next().value ?? "summary");
  if (ctx.state.inspectorSelectionKey !== selectionKey) {
    ctx.state.inspectorSelectionKey = selectionKey;
    ctx.state.activeInspectorTab = availableDefaultTab;
  } else if (!available.has(ctx.state.activeInspectorTab)) {
    ctx.state.activeInspectorTab = availableDefaultTab;
  }
  if (ctx.refs.inspectorPanel) {
    ctx.refs.inspectorPanel.dataset.activeInspectorTab =
      ctx.state.activeInspectorTab;
  }
  ctx.refs.inspectorTabs.forEach((button) => {
    const tab = button.dataset.inspectorTab;
    const visible = typeof tab === "string" && available.has(tab);
    button.hidden = !visible;
  });
  syncTablistButtons(
    ctx.refs.inspectorTabs,
    ctx.state.activeInspectorTab,
    "inspectorTab",
  );
  const tabList = ctx.refs.inspectorTabs[0]?.closest(".subtabs");
  if (tabList instanceof HTMLElement) {
    tabList.hidden = available.size <= 1;
  }
}

function setHealthTab(ctx: ViewerAppContext, tab: unknown) {
  const nextTab =
    tab === "validation" || tab === "renderer" || tab === "diagnostics"
      ? tab
      : "validation";
  ctx.state.activeHealthTab = nextTab;
  syncTablistButtons(ctx.refs.healthTabs, nextTab, "healthTab");
  ctx.refs.sidebar.querySelectorAll("[data-health-panel]").forEach((panel) => {
    if (!(panel instanceof HTMLElement)) return;
    panel.hidden = panel.dataset.healthPanel !== nextTab;
  });
  if (nextTab === "renderer" && ctx.state.currentTemplate) {
    ctx.renderRendererBindingsPanel(ctx.state.currentTemplate);
  }
}

function syncHealthState(ctx: ViewerAppContext) {
  const invalid =
    ctx.refs.validationPanel?.querySelector(".validation-summary.invalid") ||
    ctx.refs.diagnostics?.querySelector(".diagnostic.error");
  const pending = ctx.refs.validationPanel?.querySelector(
    ".validation-summary.pending",
  );
  ctx.refs.sidebarTabs.forEach((button) => {
    if (button.dataset.sidebarTab === "health") {
      button.classList.toggle("has-errors", Boolean(invalid));
      button.classList.toggle("is-checking", Boolean(pending));
      button.setAttribute("aria-busy", String(Boolean(pending)));
    }
  });
}

export function createShellPanelActions(
  getContext: () => ViewerAppContext,
): ShellPanelActions {
  return {
    syncSidebarHeading: bindViewerAction(syncSidebarHeading, getContext),
    setSidebarGroup: bindViewerAction(setSidebarGroup, getContext),
    setActionsMenuOpen: bindViewerAction(setActionsMenuOpen, getContext),
    toggleActionsMenu: bindViewerAction(toggleActionsMenu, getContext),
    handleActionsMenuKeydown: bindViewerAction(
      handleActionsMenuKeydown,
      getContext,
    ),
    syncLocaleMenuOptions: bindViewerAction(syncLocaleMenuOptions, getContext),
    selectLocaleMenuOption: bindViewerAction(
      selectLocaleMenuOption,
      getContext,
    ),
    setInspectorTab: bindViewerAction(setInspectorTab, getContext),
    syncInspectorTabs: bindViewerAction(syncInspectorTabs, getContext),
    setHealthTab: bindViewerAction(setHealthTab, getContext),
    syncHealthState: bindViewerAction(syncHealthState, getContext),
  };
}
