type TabButton = HTMLButtonElement & { dataset: DOMStringMap };

type TablistNavigationOptions = {
  activate: (value: string) => void;
  buttons: TabButton[];
  datasetKey: string;
};

const TABLIST_NAVIGATION_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "End",
  "Home",
]);

export function syncTablistButtons(
  buttons: TabButton[],
  activeValue: string,
  datasetKey: string,
): void {
  for (const button of buttons) {
    const active = button.dataset[datasetKey] === activeValue;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active && !button.hidden ? 0 : -1;
  }
}

export function installTablistNavigation({
  activate,
  buttons,
  datasetKey,
}: TablistNavigationOptions): void {
  for (const button of buttons) {
    button.addEventListener("keydown", (event) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !TABLIST_NAVIGATION_KEYS.has(event.key)
      ) {
        return;
      }
      const available = buttons.filter(
        (candidate) => !candidate.hidden && !candidate.disabled,
      );
      const currentIndex = available.indexOf(button);
      const nextIndex = resolveTablistNavigationIndex(
        currentIndex,
        available.length,
        event.key,
      );
      const next = available[nextIndex];
      const value = next?.dataset[datasetKey];
      if (!next || !value) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      next.focus({ preventScroll: true });
      activate(value);
    });
  }
}

export function wireAppTablists(ctx: ViewerAppContext): void {
  wireTablist({
    activate: (group) => ctx.setSidebarGroup(group),
    buttons: ctx.refs.sidebarTabs,
    datasetKey: "sidebarTab",
    fallback: "inspect",
  });
  wireTablist({
    activate: (tab) => ctx.setInspectorTab(tab),
    buttons: ctx.refs.inspectorTabs,
    datasetKey: "inspectorTab",
    fallback: "summary",
  });
  wireTablist({
    activate: (tab) => ctx.setHealthTab(tab),
    buttons: ctx.refs.healthTabs,
    datasetKey: "healthTab",
    fallback: "validation",
  });
}

function wireTablist({
  activate,
  buttons,
  datasetKey,
  fallback,
}: TablistNavigationOptions & { fallback: string }): void {
  for (const button of buttons) {
    button.addEventListener("click", () =>
      activate(button.dataset[datasetKey] || fallback),
    );
  }
  installTablistNavigation({ activate, buttons, datasetKey });
}

export function resolveTablistNavigationIndex(
  currentIndex: number,
  itemCount: number,
  key: string,
): number {
  if (itemCount <= 0) {
    return -1;
  }
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return itemCount - 1;
  }
  const current = currentIndex >= 0 ? currentIndex : 0;
  return key === "ArrowLeft"
    ? (current - 1 + itemCount) % itemCount
    : (current + 1) % itemCount;
}
import type { ViewerAppContext } from "./context.js";
