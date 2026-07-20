import type { ViewerAppContext } from "./context.js";
import { syncTablistButtons } from "./tablist.js";

const INSPECTOR_TABS_BY_TYPE = {
  asset: ["summary", "ownership"],
  clip: ["summary", "timing", "ownership"],
  effect: ["summary"],
  keyframe: ["summary", "timing", "ownership"],
  layer: ["summary", "transform", "ownership"],
  phase: ["summary", "timing", "ownership"],
  scene: ["summary", "timing", "ownership"],
  track: ["summary", "timing", "ownership"],
};

const DEFAULT_INSPECTOR_TAB_BY_TYPE = {
  asset: "summary",
  clip: "timing",
  effect: "summary",
  keyframe: "timing",
  layer: "transform",
  phase: "timing",
  scene: "timing",
  track: "timing",
};

function getInspectorSelectionKey(item, selectedLayers: string[] = []) {
  if (!item || item.type === "effect") {
    return "effect";
  }
  const layerSelection =
    item.type === "layer" ? `:${selectedLayers.join(",")}` : "";
  return `${item.type}:${item.layerId ?? item.sceneId ?? item.phaseId ?? item.trackId ?? item.assetId ?? ""}:${item.keyframeId ?? ""}${layerSelection}`;
}

function syncSidebarHeading(ctx: ViewerAppContext) {
  const labels = {
    health: ["viewer.sidebar.review", "Review"],
    inspect: ["viewer.sidebar.inspector", "Inspector"],
    tune: ["viewer.sidebar.effect", "Effect"],
  };
  const [key, fallback] =
    labels[ctx.state.activeSidebarGroup] ?? labels.inspect;
  if (ctx.refs.sidebarTitle) {
    ctx.refs.sidebarTitle.textContent = ctx.deps.t(key, fallback);
  }
}

function setSidebarGroup(ctx: ViewerAppContext, group) {
  const nextGroup = ["tune", "inspect", "health"].includes(group)
    ? group
    : "inspect";
  ctx.state.activeSidebarGroup = nextGroup;
  ctx.refs.sidebar.dataset.activeSidebar = nextGroup;
  syncTablistButtons(ctx.refs.sidebarTabs, nextGroup, "sidebarTab");
  ctx.refs.sidebar.querySelectorAll("[data-sidebar-panel]").forEach((panel) => {
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

function setActionsMenuOpen(ctx: ViewerAppContext, open) {
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
  if (!ctx.refs.localeSelect || !["ru", "en"].includes(String(locale))) {
    return;
  }
  ctx.refs.localeSelect.value = String(locale);
  ctx.refs.localeSelect.dispatchEvent(new Event("change", { bubbles: true }));
}

function toggleActionsMenu(ctx: ViewerAppContext) {
  ctx.setActionsMenuOpen(!ctx.state.actionsMenuOpen);
}

function handleActionsMenuKeydown(ctx: ViewerAppContext, event) {
  const trigger = ctx.refs.appActionsButton;
  const menu = ctx.refs.appActionsMenu;
  const items = Array.from(
    menu?.querySelectorAll("button:not(:disabled)") ?? [],
  ) as HTMLButtonElement[];
  const activeIndex = items.indexOf(
    document.activeElement as HTMLButtonElement,
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

function setInspectorTab(ctx: ViewerAppContext, tab) {
  const nextTab = ["summary", "timing", "transform", "ownership"].includes(tab)
    ? tab
    : "summary";
  ctx.state.activeInspectorTab = nextTab;
  syncTablistButtons(ctx.refs.inspectorTabs, nextTab, "inspectorTab");
  if (ctx.refs.inspectorPanel) {
    ctx.refs.inspectorPanel.dataset.activeInspectorTab = nextTab;
    ctx.refs.inspectorPanel
      .querySelectorAll("[data-inspector-section]")
      .forEach((panel) => {
        panel.hidden = panel.dataset.inspectorSection !== nextTab;
      });
  }
  ctx.renderInspector();
}

function syncInspectorTabs(
  ctx: ViewerAppContext,
  item = ctx.state.selectedItem ?? { type: "effect" },
) {
  const type = item?.type ?? "effect";
  const available = new Set(
    INSPECTOR_TABS_BY_TYPE[type] ?? INSPECTOR_TABS_BY_TYPE.effect,
  );
  if (type === "layer") {
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
    const visible = available.has(tab);
    button.hidden = !visible;
  });
  syncTablistButtons(
    ctx.refs.inspectorTabs,
    ctx.state.activeInspectorTab,
    "inspectorTab",
  );
  const tabList = ctx.refs.inspectorTabs[0]?.closest(".subtabs");
  if (tabList) {
    tabList.hidden = available.size <= 1;
  }
}

function setHealthTab(ctx: ViewerAppContext, tab) {
  const nextTab = ["validation", "renderer", "diagnostics"].includes(tab)
    ? tab
    : "validation";
  ctx.state.activeHealthTab = nextTab;
  syncTablistButtons(ctx.refs.healthTabs, nextTab, "healthTab");
  ctx.refs.sidebar.querySelectorAll("[data-health-panel]").forEach((panel) => {
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

export function installAppShellPanelsOwner(ctx: ViewerAppContext): void {
  ctx.syncSidebarHeading = (...args: any[]) =>
    (syncSidebarHeading as any)(ctx, ...args);
  ctx.setSidebarGroup = (...args: any[]) =>
    (setSidebarGroup as any)(ctx, ...args);
  ctx.setActionsMenuOpen = (...args: any[]) =>
    (setActionsMenuOpen as any)(ctx, ...args);
  ctx.toggleActionsMenu = (...args: any[]) =>
    (toggleActionsMenu as any)(ctx, ...args);
  ctx.handleActionsMenuKeydown = (...args: any[]) =>
    (handleActionsMenuKeydown as any)(ctx, ...args);
  ctx.syncLocaleMenuOptions = (...args: any[]) =>
    (syncLocaleMenuOptions as any)(ctx, ...args);
  ctx.selectLocaleMenuOption = (...args: any[]) =>
    (selectLocaleMenuOption as any)(ctx, ...args);
  ctx.setInspectorTab = (...args: any[]) =>
    (setInspectorTab as any)(ctx, ...args);
  ctx.syncInspectorTabs = (...args: any[]) =>
    (syncInspectorTabs as any)(ctx, ...args);
  ctx.setHealthTab = (...args: any[]) => (setHealthTab as any)(ctx, ...args);
  ctx.syncHealthState = (...args: any[]) =>
    (syncHealthState as any)(ctx, ...args);
}
