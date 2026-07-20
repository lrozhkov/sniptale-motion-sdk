import type { ViewerAppContext } from "../app/context.js";
import {
  createLayerSelectionInspectorModel,
  isLayerSelectionInspector,
} from "./layer-selection-model.js";
import {
  appendSelectionCommonProperties,
  createSelectionNumberField,
} from "./layer-selection-fields.js";

function appendLayerMultiSelectionOverview(ctx: ViewerAppContext, template) {
  const model = createLayerSelectionInspectorModel(ctx, template);
  if (!model) {
    return;
  }
  if (ctx.isInspectorSectionActive("summary")) {
    ctx.setInspectorAppendSection("summary");
    appendSelectionSummary(ctx, model);
  }
  if (ctx.isInspectorSectionActive("transform")) {
    ctx.setInspectorAppendSection("transform");
    appendSelectionActions(ctx, model);
    appendSelectionFrame(ctx, model);
    appendSelectionAlignment(ctx, model);
    appendSelectionCommonProperties(ctx, model);
  }
}

function appendSelectionSummary(ctx, model): void {
  const typeCount = new Set(model.layers.map((layer) => layer.type)).size;
  ctx.appendInspectorRows(
    model.groupLayer?.name ??
      ctx.deps.t("viewer.inspector.selection.title", "Layer selection"),
    [
      [
        ctx.deps.t("viewer.inspector.selection.items", "Items"),
        String(model.layers.length),
      ],
      [
        ctx.deps.t("viewer.inspector.selection.types", "Types"),
        String(typeCount),
      ],
      [
        ctx.deps.t("viewer.inspector.selection.locked", "Locked"),
        String(model.stats.locked),
      ],
      [
        ctx.deps.t("viewer.inspector.selection.hidden", "Hidden"),
        String(model.stats.hidden),
      ],
      [
        ctx.deps.t("viewer.inspector.selection.inactive", "Inactive"),
        String(model.stats.inactive),
      ],
      [
        ctx.deps.t("viewer.inspector.selection.nonSpatial", "Non-spatial"),
        String(model.stats.nonSpatial),
      ],
    ],
  );
}

function appendSelectionActions(ctx, model): void {
  const group = createInspectorPropertyGroup(
    ctx.deps.t("viewer.inspector.selection.structure", "Structure"),
    "inspector-selection-actions",
  );
  group.body.classList.add("inspector-selection-action-row");
  group.body.append(
    createSelectionActionButton(
      ctx,
      ctx.deps.t("viewer.layers.group", "Group"),
      "Ctrl/Cmd+G",
      !model.grouping.canGroup,
      () => ctx.groupSelectedLayers(),
    ),
    createSelectionActionButton(
      ctx,
      ctx.deps.t("viewer.layers.ungroup", "Ungroup"),
      "Ctrl/Cmd+Shift+G",
      !model.grouping.canUngroup,
      () => ctx.ungroupSelectedLayers(),
    ),
  );
  ctx.appendInspectorNode(group.root);
}

function appendSelectionFrame(ctx, model): void {
  const group = createInspectorPropertyGroup(
    ctx.deps.t("viewer.inspector.selection.frame", "Selection frame"),
    "inspector-property-grid paired inspector-selection-frame",
  );
  for (const [property, label, value] of [
    [
      "left",
      ctx.deps.t("viewer.inspector.selection.left", "Left"),
      model.bounds?.x,
    ],
    [
      "top",
      ctx.deps.t("viewer.inspector.selection.top", "Top"),
      model.bounds?.y,
    ],
    [
      "width",
      ctx.deps.t("viewer.inspector.selection.width", "Width"),
      model.bounds?.width,
    ],
    [
      "height",
      ctx.deps.t("viewer.inspector.selection.height", "Height"),
      model.bounds?.height,
    ],
  ]) {
    const sizeProperty = property === "width" || property === "height";
    group.body.append(
      createSelectionNumberField(ctx, {
        disabled: sizeProperty
          ? !model.frameScaleEditable
          : !model.frameMoveEditable,
        label,
        onChange: (next) => ctx.setCanvasSelectionFrameProperty(property, next),
        value,
      }),
    );
  }
  if (!model.frameMoveEditable || !model.frameScaleEditable) {
    group.root.append(createSelectionUnavailableNote(ctx, model));
  }
  ctx.appendInspectorNode(group.root);
}

function appendSelectionAlignment(ctx, model): void {
  const group = createInspectorPropertyGroup(
    ctx.deps.t("viewer.inspector.selection.layout", "Align & distribute"),
    "inspector-selection-layout",
  );
  const align = document.createElement("div");
  align.className = "inspector-selection-button-grid";
  for (const [alignment, key, fallback] of [
    ["left", "alignLeft", "Left"],
    ["horizontal-center", "alignHorizontalCenter", "Center"],
    ["right", "alignRight", "Right"],
    ["top", "alignTop", "Top"],
    ["vertical-center", "alignVerticalCenter", "Middle"],
    ["bottom", "alignBottom", "Bottom"],
  ]) {
    align.append(
      createSelectionActionButton(
        ctx,
        ctx.deps.t(`viewer.inspector.selection.${key}`, fallback),
        "",
        !model.frameMoveEditable,
        () => ctx.alignLayerSelection(alignment),
      ),
    );
  }
  const distribute = document.createElement("div");
  distribute.className = "inspector-selection-action-row";
  distribute.append(
    createSelectionActionButton(
      ctx,
      ctx.deps.t(
        "viewer.inspector.selection.distributeHorizontal",
        "Equal horizontal gaps",
      ),
      "",
      !model.frameMoveEditable || model.layers.length < 3,
      () => ctx.distributeLayerSelection("horizontal"),
    ),
    createSelectionActionButton(
      ctx,
      ctx.deps.t(
        "viewer.inspector.selection.distributeVertical",
        "Equal vertical gaps",
      ),
      "",
      !model.frameMoveEditable || model.layers.length < 3,
      () => ctx.distributeLayerSelection("vertical"),
    ),
  );
  group.body.append(align, distribute);
  ctx.appendInspectorNode(group.root);
}

function createSelectionActionButton(_ctx, label, shortcut, disabled, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary compact";
  button.textContent = label;
  button.disabled = disabled;
  button.title = shortcut ? `${label} · ${shortcut}` : label;
  button.addEventListener("click", action);
  return button;
}

function createInspectorPropertyGroup(label, bodyClass) {
  const root = document.createElement("section");
  root.className = "inspector-property-group";
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = label;
  const body = document.createElement("div");
  body.className = bodyClass;
  root.append(heading, body);
  return { body, root };
}

function createSelectionUnavailableNote(ctx, model) {
  const note = document.createElement("p");
  note.className = "inspector-capability-note";
  note.textContent = model.frameMoveEditable
    ? ctx.deps.t(
        "viewer.inspector.selection.resizeUnavailable",
        "Proportional resize is unavailable because one or more selected layers do not support scale.",
      )
    : ctx.deps.t(
        "viewer.inspector.selection.operationUnavailable",
        "This operation requires every selected layer to be active, unlocked, and spatial.",
      );
  return note;
}

export function installInspectorLayerSelectionOwner(
  ctx: ViewerAppContext,
): void {
  ctx.isLayerSelectionInspector = (...args: any[]) =>
    (isLayerSelectionInspector as any)(ctx, ...args);
  ctx.appendLayerMultiSelectionOverview = (...args: any[]) =>
    (appendLayerMultiSelectionOverview as any)(ctx, ...args);
}
