import { bindViewerAction } from "../app/bind-action.js";
import type { InspectorHealthActions } from "./health-contract.js";
import type { EditorValidationIssue } from "../validation/types.js";
import type { EditorTemplateSource } from "../templates/model.js";
import type { ViewerAppContext } from "../app/context.js";

function renderValidationPanel(
  ctx: ViewerAppContext,
  template: EditorTemplateSource | null = ctx.state.currentTemplate,
) {
  ctx.refs.validationPanel.innerHTML = "";
  ctx.refs.validationPanel.setAttribute("aria-busy", "false");
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!template || !effectiveTemplate) {
    ctx.refs.validationPanel.textContent = ctx.deps.t(
      "viewer.validation.noTemplate",
      "No template",
    );
    ctx.syncHealthState();
    return;
  }
  const contractPending = ctx.isRendererContractCoveragePending(template);
  ctx.refs.validationPanel.setAttribute("aria-busy", String(contractPending));
  const issues: EditorValidationIssue[] =
    ctx.collectEditorValidationIssues(effectiveTemplate);
  if (contractPending) {
    const pending = document.createElement("div");
    pending.className = "validation-summary pending";
    pending.setAttribute("role", "status");
    pending.textContent = ctx.deps.t(
      "viewer.validation.checkingRendererContract",
      "Checking renderer contract…",
    );
    ctx.refs.validationPanel.append(pending);
  }
  if (issues.length === 0) {
    if (!contractPending) {
      const valid = document.createElement("div");
      valid.className = "validation-empty";
      valid.textContent = ctx.deps.t(
        "viewer.validation.validForExport",
        "Valid for export",
      );
      ctx.refs.validationPanel.append(valid);
    }
    ctx.syncHealthState();
    return;
  }
  const summary = document.createElement("div");
  summary.className = "validation-summary invalid";
  summary.textContent = ctx.deps
    .t("viewer.validation.issueCount", "Validation issues: {count}")
    .replace("{count}", String(issues.length));
  ctx.refs.validationPanel.append(summary);
  const groups = ctx.groupValidationIssues(issues.slice(0, 18));
  for (const [category, groupIssues] of groups) {
    const group = document.createElement("div");
    group.className = "validation-group";
    group.dataset.validationCategory = category.toLowerCase();
    const heading = document.createElement("div");
    heading.className = "validation-group-heading";
    const categoryLabel = ctx.deps.t(
      `viewer.validation.categories.${category.toLowerCase()}`,
      category,
    );
    heading.textContent = `${categoryLabel} (${groupIssues.length})`;
    group.append(heading);
    for (const issue of groupIssues) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "validation-issue";
      row.dataset.validationCategory = category.toLowerCase();
      row.dataset.targetType = issue.targetType;
      if (issue.targetId) {
        row.dataset.targetId = issue.targetId;
      }
      if (issue.trackId) {
        row.dataset.trackId = issue.trackId;
      }
      if (issue.keyframeId) {
        row.dataset.keyframeId = issue.keyframeId;
      }
      const message = document.createElement("strong");
      const localizedMessage = localizeValidationIssueMessage(ctx, issue);
      message.textContent = localizedMessage;
      const target = document.createElement("span");
      target.textContent = ctx.issueTargetLabel(issue);
      row.title = `${categoryLabel}\n${localizedMessage}\n${ctx.issueTargetLabel(issue)}`;
      row.append(message, target);
      row.addEventListener("click", () => ctx.focusValidationIssue(issue));
      group.append(row);
    }
    ctx.refs.validationPanel.append(group);
  }
  ctx.syncHealthState();
}

function localizeValidationIssueMessage(
  ctx: ViewerAppContext,
  issue: EditorValidationIssue,
) {
  let localized = issue.messageKey
    ? ctx.deps.t(
        `viewer.validation.messages.${issue.messageKey}`,
        issue.message,
      )
    : issue.message;
  for (const [name, rawValue] of Object.entries(issue.messageParams ?? {})) {
    const value =
      rawValue === "(missing)"
        ? ctx.deps.t("viewer.validation.missingValue", "not set")
        : String(rawValue);
    localized = localized.replaceAll(`{${name}}`, value);
  }
  if (issue.presetId) {
    localized = ctx.deps
      .t(
        "viewer.validation.messages.presetPrefix",
        'Preset "{preset}": {message}',
      )
      .replace("{preset}", issue.presetId)
      .replace("{message}", localized);
  }
  return localized;
}

function groupValidationIssues(
  ctx: ViewerAppContext,
  issues: readonly EditorValidationIssue[],
) {
  const priority = [
    "Contract",
    "Timing",
    "Refs",
    "Assets",
    "Renderer",
    "Security",
    "Schema",
  ];
  const groups = new Map<string, EditorValidationIssue[]>(
    priority.map((category) => [category, []]),
  );
  for (const issue of issues) {
    const category = issue.category ?? ctx.categorizeValidationIssue(issue);
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)?.push(issue);
  }
  return [...groups.entries()].filter(
    ([, groupIssues]) => groupIssues.length > 0,
  );
}

function issueTargetLabel(ctx: ViewerAppContext, issue: EditorValidationIssue) {
  const id = issue.keyframeId || issue.targetId || issue.trackId || "effect";
  const type = ctx.deps.t(
    `viewer.selection.types.${issue.targetType}`,
    issue.targetType,
  );
  return `${type}: ${id}`;
}

function focusValidationIssue(
  ctx: ViewerAppContext,
  issue: EditorValidationIssue,
) {
  if (!ctx.state.currentTemplate) {
    return;
  }
  if (issue.targetType === "keyframe" && issue.trackId && issue.keyframeId) {
    ctx.selectKeyframe(issue.trackId, issue.keyframeId);
    ctx.scrollTimelineTargetIntoView(
      `.keyframe-point[data-track-id="${ctx.cssEscape(issue.trackId)}"][data-keyframe-id="${ctx.cssEscape(issue.keyframeId)}"]`,
    );
    return;
  }
  if (issue.targetType === "clip" && issue.targetId) {
    ctx.selectClipBlock(issue.targetId);
    ctx.renderTimelineEditor(ctx.state.currentTemplate);
    ctx.scrollTimelineTargetIntoView(
      `.clip-block[data-layer-id="${ctx.cssEscape(issue.targetId)}"]`,
    );
    return;
  }
  if (issue.targetType === "phase" && issue.targetId) {
    ctx.selectPhaseBlock(issue.targetId);
    ctx.renderTimelineEditor(ctx.state.currentTemplate);
    ctx.scrollTimelineTargetIntoView(
      `.phase-block[data-phase-id="${ctx.cssEscape(issue.targetId)}"]`,
    );
    return;
  }
  if (issue.targetType === "scene" && issue.targetId) {
    ctx.selectSceneBlock(issue.targetId);
    ctx.renderTimelineEditor(ctx.state.currentTemplate);
    ctx.scrollTimelineTargetIntoView(
      `.scene-block[data-scene-id="${ctx.cssEscape(issue.targetId)}"]`,
    );
    return;
  }
  if (issue.targetType === "track" && issue.targetId) {
    ctx.selectTrackLane(issue.targetId);
    ctx.renderTimelineEditor(ctx.state.currentTemplate);
    ctx.scrollTimelineTargetIntoView(
      `.timeline-lane[data-track-id="${ctx.cssEscape(issue.targetId)}"]`,
    );
    return;
  }
  if (issue.targetType === "layer" && issue.targetId) {
    ctx.focusLayer(issue.targetId);
    return;
  }
  if (issue.targetType === "asset" && issue.targetId) {
    ctx.selectAsset(issue.targetId);
    const row = ctx.refs.assetsPanel.querySelector(
      `.asset-row[data-asset-id="${ctx.cssEscape(issue.targetId)}"]`,
    );
    row?.scrollIntoView({ block: "center", inline: "nearest" });
    return;
  }
  if (issue.targetType === "control" && issue.targetId) {
    ctx.setSidebarGroup("tune");
    const row = ctx.refs.controlsPanel.querySelector(
      `.control-row[data-control-id="${ctx.cssEscape(issue.targetId)}"]`,
    );
    row?.scrollIntoView({ block: "center", inline: "nearest" });
    const control = row?.querySelector("input, select, button");
    if (control instanceof HTMLElement) control.focus();
    return;
  }
  ctx.clearTimelineSelection();
  ctx.renderTimelineEditor(ctx.state.currentTemplate);
}

function scrollTimelineTargetIntoView(ctx: ViewerAppContext, selector: string) {
  const element = ctx.refs.timelineTracks.querySelector(selector);
  element?.scrollIntoView({ block: "center", inline: "center" });
}

export function createInspectorHealthActions(
  getContext: () => ViewerAppContext,
): Pick<
  InspectorHealthActions,
  | "renderValidationPanel"
  | "groupValidationIssues"
  | "issueTargetLabel"
  | "focusValidationIssue"
  | "scrollTimelineTargetIntoView"
> {
  return {
    renderValidationPanel: bindViewerAction(renderValidationPanel, getContext),
    groupValidationIssues: bindViewerAction(groupValidationIssues, getContext),
    issueTargetLabel: bindViewerAction(issueTargetLabel, getContext),
    focusValidationIssue: bindViewerAction(focusValidationIssue, getContext),
    scrollTimelineTargetIntoView: bindViewerAction(
      scrollTimelineTargetIntoView,
      getContext,
    ),
  };
}
