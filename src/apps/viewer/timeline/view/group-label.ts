import type { ViewerAppContext } from "../../app/context.js";

function formatTrackCount(ctx: ViewerAppContext, count: number) {
  const pluralCategory = new Intl.PluralRules(ctx.deps.getLocale()).select(
    count,
  );
  const messageKey = {
    few: "viewer.timeline.trackCountFew",
    many: "viewer.timeline.trackCountMany",
    one: "viewer.timeline.trackCountOne",
    other: "viewer.timeline.trackCountOther",
    two: "viewer.timeline.trackCountOther",
    zero: "viewer.timeline.trackCountMany",
  }[pluralCategory];
  return ctx.deps
    .t(messageKey, count === 1 ? "{count} track" : "{count} tracks")
    .replace("{count}", String(count));
}

function decorateTimelineGroupLabel(ctx: ViewerAppContext, lane, options) {
  lane.label.classList.add("timeline-group-label");
  const metadata = options.metadata
    ? ctx.deps.t(
        `viewer.timeline.layerTypes.${options.metadata}`,
        options.metadata,
      )
    : "";
  const scope = options.scope
    ? ctx.deps.t(`viewer.timeline.scopes.${options.scope}`, options.scope)
    : "";
  const details = [scope, metadata].filter(Boolean).join(" · ");
  if (options.count <= 0) {
    lane.label.classList.add("timeline-group-label-empty");
    const kind = lane.label.querySelector(".timeline-lane-kind");
    if (kind) {
      kind.textContent =
        details ||
        ctx.deps.t("viewer.timeline.noOwnedTracks", "No owned tracks");
    }
    syncTimelineGroupLabelTitle(lane.label);
    return;
  }
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = `timeline-group-toggle${options.expanded ? " expanded" : ""}`;
  toggle.dataset.rowType = options.type;
  toggle.dataset.rowId = options.id;
  toggle.replaceChildren(ctx.createViewerIcon("chevronRight"));
  toggle.setAttribute(
    "aria-label",
    options.expanded
      ? ctx.deps.t("viewer.timeline.collapseRow", "Collapse row")
      : ctx.deps.t("viewer.timeline.expandRow", "Expand row"),
  );
  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    ctx.toggleTimelineRowExpansion(options.type, options.id);
  });
  const title = lane.label.querySelector(".timeline-lane-title");
  if (title) {
    title.textContent = options.label;
  }
  const kind = lane.label.querySelector(".timeline-lane-kind");
  if (kind) {
    const count = options.countText ?? formatTrackCount(ctx, options.count);
    kind.textContent = details ? `${count} · ${details}` : count;
  }
  syncTimelineGroupLabelTitle(lane.label);
  lane.label.prepend(toggle);
  lane.label.addEventListener("dblclick", (event) => {
    event.preventDefault();
    ctx.toggleTimelineRowExpansion(options.type, options.id);
  });
}

function syncTimelineGroupLabelTitle(label: HTMLElement): void {
  const title = label
    .querySelector(".timeline-lane-title")
    ?.textContent?.trim();
  const kind = label.querySelector(".timeline-lane-kind")?.textContent?.trim();
  label.title = [title, kind].filter(Boolean).join("\n");
}

function renderPropertyTrackRows(
  ctx: ViewerAppContext,
  template,
  effectiveTemplate,
  timeline,
  sceneGroup,
  scene,
  trackRows,
  ownershipLinks,
  duration,
  inheritedDisabled = false,
) {
  for (const trackRow of trackRows) {
    ctx.renderTimelinePropertyTrackLane(
      template,
      effectiveTemplate,
      timeline,
      scene,
      trackRow.track,
      trackRow.keyframes,
      ownershipLinks,
      duration,
      {
        group: sceneGroup,
        id: trackRow.parent.id,
        layerId: trackRow.parent.layerId ?? trackRow.parent.id,
        phaseId:
          trackRow.parent.type === "layerPhase" ||
          trackRow.parent.type === "scenePhase"
            ? trackRow.parent.id
            : null,
        depth: trackRow.depth,
        inheritedDisabled,
        type: trackRow.parent.type,
      },
    );
  }
}

export function installTimelineGroupLabelViewOwner(
  ctx: ViewerAppContext,
): void {
  ctx.decorateTimelineGroupLabel = decorateTimelineGroupLabel.bind(
    undefined,
    ctx,
  );
  ctx.renderPropertyTrackRows = renderPropertyTrackRows.bind(undefined, ctx);
}
