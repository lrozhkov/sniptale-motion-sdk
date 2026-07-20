import type { ViewerAppContext } from "../../app/context.js";

function wireTimelineLayerSearch(ctx: ViewerAppContext): void {
  ctx.refs.timelineLayerSearchButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (ctx.state.timelineLayerSearchOpen) {
      closeTimelineLayerSearch(ctx, { focusTrigger: true });
    } else {
      openTimelineLayerSearch(ctx);
    }
  });
  ctx.refs.timelineLayerSearchInput.addEventListener("input", () => {
    ctx.state.timelineLayerSearchQuery =
      ctx.refs.timelineLayerSearchInput.value;
    ctx.state.timelineLayerSearchActiveIndex = 0;
    renderTimelineLayerSearch(ctx);
  });
  ctx.refs.timelineLayerSearchInput.addEventListener("keydown", (event) =>
    handleTimelineLayerSearchKeydown(ctx, event),
  );
  document.addEventListener("pointerdown", (event) => {
    if (
      ctx.state.timelineLayerSearchOpen &&
      event.target instanceof Element &&
      !event.target.closest(
        "#timelineLayerSearchButton, #timelineLayerSearchPopup",
      )
    ) {
      closeTimelineLayerSearch(ctx);
    }
  });
}

function openTimelineLayerSearch(ctx: ViewerAppContext): void {
  ctx.state.timelineLayerSearchOpen = true;
  ctx.state.timelineLayerSearchActiveIndex = 0;
  rebuildTimelineLayerSearchIndex(ctx);
  renderTimelineLayerSearch(ctx);
  requestAnimationFrame(() => {
    ctx.refs.timelineLayerSearchInput.focus();
    ctx.refs.timelineLayerSearchInput.select();
  });
}

function closeTimelineLayerSearch(
  ctx: ViewerAppContext,
  options: { clear?: boolean; focusTrigger?: boolean } = {},
): void {
  ctx.state.timelineLayerSearchOpen = false;
  ctx.state.timelineLayerSearchActiveIndex = -1;
  if (options.clear) {
    ctx.state.timelineLayerSearchQuery = "";
  }
  ctx.timelineLayerSearchIndexCache = null;
  renderTimelineLayerSearch(ctx);
  if (options.focusTrigger) {
    ctx.refs.timelineLayerSearchButton.focus({ preventScroll: true });
  }
}

function renderTimelineLayerSearch(ctx: ViewerAppContext): void {
  const open = Boolean(ctx.state.timelineLayerSearchOpen);
  const query = String(ctx.state.timelineLayerSearchQuery ?? "");
  ensureTimelineLayerSearchIndex(ctx);
  const results = open
    ? ctx.filterTimelineLayerSearchResults(
        ctx.timelineLayerSearchIndexCache ?? [],
        query,
      )
    : [];
  ctx.timelineLayerSearchResultsCache = results;
  const activeIndex =
    results.length > 0
      ? ctx.deps.clamp(
          Number(ctx.state.timelineLayerSearchActiveIndex) || 0,
          0,
          results.length - 1,
        )
      : -1;
  ctx.state.timelineLayerSearchActiveIndex = activeIndex;
  ctx.refs.timelineLayerSearchPopup.hidden = !open;
  ctx.refs.timelineLayerSearchButton.setAttribute(
    "aria-expanded",
    String(open),
  );
  ctx.refs.timelineLayerSearchInput.setAttribute("aria-expanded", String(open));
  ctx.refs.timelineLayerSearchResults.hidden = !open;
  if (ctx.refs.timelineLayerSearchInput.value !== query) {
    ctx.refs.timelineLayerSearchInput.value = query;
  }
  ctx.refs.timelineLayerSearchResults.replaceChildren(
    ...results.map((result, index) =>
      createTimelineLayerSearchOption(
        ctx,
        result,
        index,
        index === activeIndex,
      ),
    ),
  );
  const activeOption =
    activeIndex >= 0 ? `timeline-layer-search-option-${activeIndex}` : "";
  if (activeOption) {
    ctx.refs.timelineLayerSearchInput.setAttribute(
      "aria-activedescendant",
      activeOption,
    );
    requestAnimationFrame(() =>
      document
        .getElementById(activeOption)
        ?.scrollIntoView({ block: "nearest" }),
    );
  } else {
    ctx.refs.timelineLayerSearchInput.removeAttribute("aria-activedescendant");
  }
  ctx.refs.timelineLayerSearchEmpty.hidden = results.length > 0;
  ctx.refs.timelineLayerSearchEmpty.textContent = query.trim()
    ? ctx.deps.t("viewer.timeline.searchLayersNoResults", "No matching layers.")
    : ctx.deps.t(
        "viewer.timeline.searchLayersHint",
        "Type a layer name, ID, type, or group path.",
      );
}

function ensureTimelineLayerSearchIndex(ctx: ViewerAppContext): void {
  if (!ctx.state.timelineLayerSearchOpen) {
    return;
  }
  const templateId = ctx.state.currentTemplate?.id ?? null;
  const locale = ctx.deps.getLocale();
  if (
    !ctx.timelineLayerSearchIndexCache ||
    ctx.timelineLayerSearchIndexTemplateId !== templateId ||
    ctx.timelineLayerSearchIndexLocale !== locale
  ) {
    rebuildTimelineLayerSearchIndex(ctx);
  }
}

function rebuildTimelineLayerSearchIndex(ctx: ViewerAppContext): void {
  ctx.timelineLayerSearchIndexCache = ctx.createTimelineLayerSearchIndex(
    ctx.state.currentTemplate,
  );
  ctx.timelineLayerSearchIndexTemplateId =
    ctx.state.currentTemplate?.id ?? null;
  ctx.timelineLayerSearchIndexLocale = ctx.deps.getLocale();
}

function createTimelineLayerSearchOption(
  ctx: ViewerAppContext,
  result,
  index: number,
  active: boolean,
): HTMLElement {
  const option = document.createElement("button");
  option.id = `timeline-layer-search-option-${index}`;
  option.type = "button";
  option.className = `timeline-layer-search-option${active ? " active" : ""}`;
  option.setAttribute("role", "option");
  option.setAttribute("aria-selected", String(active));
  const title = document.createElement("strong");
  title.textContent = result.name;
  const context = document.createElement("span");
  const parentPath = result.path.slice(0, -1).join(" › ");
  context.textContent = [parentPath, result.sceneLabel, result.typeLabel]
    .filter(Boolean)
    .join(" · ");
  const badges = document.createElement("span");
  badges.className = "timeline-layer-search-badges";
  if (result.locked) {
    badges.append(
      createSearchBadge(
        ctx.deps.t("viewer.timeline.searchLayerLocked", "Locked"),
      ),
    );
  }
  if (result.hidden) {
    badges.append(
      createSearchBadge(
        ctx.deps.t("viewer.timeline.searchLayerHidden", "Hidden"),
      ),
    );
  }
  option.append(title, context, badges);
  option.addEventListener("pointerenter", () => {
    if (ctx.state.timelineLayerSearchActiveIndex === index) {
      return;
    }
    ctx.state.timelineLayerSearchActiveIndex = index;
    renderTimelineLayerSearch(ctx);
  });
  option.addEventListener("click", () => {
    if (ctx.revealTimelineLayer(result)) {
      closeTimelineLayerSearch(ctx, { clear: true });
    }
  });
  return option;
}

function createSearchBadge(label: string): HTMLElement {
  const badge = document.createElement("small");
  badge.textContent = label;
  return badge;
}

function handleTimelineLayerSearchKeydown(ctx: ViewerAppContext, event): void {
  const results = ctx.timelineLayerSearchResultsCache ?? [];
  if (event.code === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeTimelineLayerSearch(ctx, { focusTrigger: true });
    return;
  }
  if (event.code === "ArrowDown" || event.code === "ArrowUp") {
    event.preventDefault();
    if (results.length === 0) {
      return;
    }
    const direction = event.code === "ArrowDown" ? 1 : -1;
    const current = Number(ctx.state.timelineLayerSearchActiveIndex) || 0;
    ctx.state.timelineLayerSearchActiveIndex =
      (current + direction + results.length) % results.length;
    renderTimelineLayerSearch(ctx);
    return;
  }
  if (event.code === "Enter" && results.length > 0) {
    event.preventDefault();
    const index = ctx.deps.clamp(
      Number(ctx.state.timelineLayerSearchActiveIndex) || 0,
      0,
      results.length - 1,
    );
    if (ctx.revealTimelineLayer(results[index])) {
      closeTimelineLayerSearch(ctx, { clear: true });
    }
  }
}

export function installTimelineLayerSearchController(
  ctx: ViewerAppContext,
): void {
  Object.assign(ctx, {
    closeTimelineLayerSearch: (...args: any[]) =>
      (closeTimelineLayerSearch as any)(ctx, ...args),
    openTimelineLayerSearch: (...args: any[]) =>
      (openTimelineLayerSearch as any)(ctx, ...args),
    renderTimelineLayerSearch: (...args: any[]) =>
      (renderTimelineLayerSearch as any)(ctx, ...args),
    wireTimelineLayerSearch: (...args: any[]) =>
      (wireTimelineLayerSearch as any)(ctx, ...args),
  });
}
