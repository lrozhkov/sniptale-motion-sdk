import type { GraphEditorModel } from "./model-types.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  getKeyframeEasingLabel,
  KEYFRAME_EASING_PRESETS,
} from "../inspector/keyframe-labels.js";

export function createGraphEditorToolbar(
  ctx: ViewerAppContext,
  model: GraphEditorModel,
): HTMLElement {
  const toolbar = document.createElement("div");
  toolbar.className = "graph-editor-toolbar";
  const heading = document.createElement("div");
  heading.className = "graph-editor-heading";
  const title = document.createElement("strong");
  title.textContent = ctx.deps.t("viewer.graphEditor.title", "Graph Editor");
  const status = document.createElement("span");
  status.textContent = ctx.deps
    .t(
      model.multiTrack
        ? "viewer.graphEditor.multiTrackStatus"
        : "viewer.graphEditor.selectionStatus",
      model.multiTrack
        ? "{keys} keys · {tracks} tracks · time drag only"
        : "{keys} keys · {tracks} track",
    )
    .replace("{keys}", String(model.selection.length))
    .replace("{tracks}", String(model.tracks.length));
  heading.append(title, status);

  const actions = document.createElement("div");
  actions.className = "graph-editor-actions";
  actions.append(
    createActionButton(
      ctx.deps.t("viewer.graphEditor.fitSelection", "Fit selection"),
      () => void ctx.fitGraphEditor("selection"),
    ),
    createActionButton(
      ctx.deps.t("viewer.graphEditor.fitAll", "Fit curves"),
      () => void ctx.fitGraphEditor("all"),
    ),
    createActionButton(
      ctx.deps.t("viewer.graphEditor.zoomOut", "Zoom out"),
      () => void ctx.zoomGraphEditor(1.25),
      "−",
      "graph-editor-icon-action",
    ),
    createActionButton(
      ctx.deps.t("viewer.graphEditor.zoomIn", "Zoom in"),
      () => void ctx.zoomGraphEditor(0.8),
      "+",
      "graph-editor-icon-action",
    ),
    createLinkedHandlesButton(ctx, model),
    createEasingPresetField(ctx, model),
    createActionButton(
      ctx.deps.t("viewer.graphEditor.close", "Close Graph Editor"),
      () => void ctx.toggleGraphEditor(false),
      "×",
      "graph-editor-icon-action",
    ),
  );
  toolbar.append(heading, actions);
  return toolbar;
}

function createLinkedHandlesButton(
  ctx: ViewerAppContext,
  model: GraphEditorModel,
) {
  const button = createActionButton(
    model.linkedHandles
      ? ctx.deps.t("viewer.graphEditor.linkedHandles", "Linked handles")
      : ctx.deps.t("viewer.graphEditor.splitHandles", "Split handles"),
    () => ctx.setGraphEditorLinkedHandles(!model.linkedHandles),
  );
  button.classList.toggle("active", model.linkedHandles);
  button.setAttribute("aria-pressed", String(model.linkedHandles));
  return button;
}

function createEasingPresetField(
  ctx: ViewerAppContext,
  model: GraphEditorModel,
) {
  const label = document.createElement("label");
  label.className = "graph-editor-easing-field";
  const name = document.createElement("span");
  name.textContent = ctx.deps.t("viewer.graphEditor.easingPreset", "Easing");
  const select = document.createElement("select");
  select.disabled = !model.canEditEasing;
  const easingValues = model.selection.map(
    (entry) => entry.keyframe.easing ?? "linear",
  );
  const common = easingValues.every((value) => value === easingValues[0])
    ? easingValues[0]
    : "";
  if (!common) {
    const mixed = document.createElement("option");
    mixed.value = "";
    mixed.textContent = ctx.deps.t(
      "viewer.inspector.keyframeSelection.mixed",
      "—",
    );
    select.append(mixed);
  }
  for (const easing of KEYFRAME_EASING_PRESETS) {
    const option = document.createElement("option");
    option.value = easing;
    option.textContent = getKeyframeEasingLabel(ctx, easing);
    select.append(option);
  }
  select.value = common ?? "";
  select.addEventListener("change", () => {
    if (select.value) {
      ctx.updateSelectedKeyframesBatch({ easing: select.value });
    }
  });
  label.append(name, select);
  return label;
}

function createActionButton(
  label: string,
  action: () => void,
  text = label,
  className = "",
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `secondary compact ${className}`.trim();
  button.textContent = text;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", action);
  return button;
}
