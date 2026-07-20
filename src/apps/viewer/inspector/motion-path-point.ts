import type { ViewerAppContext } from "../app/context.js";
import type { MotionPathPointKind } from "../../../shared/timeline/motion-path.js";

const POINT_KINDS: MotionPathPointKind[] = ["linear", "smooth", "corner"];

function appendMotionPathPointInspector(
  ctx: ViewerAppContext,
  template,
): boolean {
  const selections = ctx.getFullySelectedCanvasMotionPathPoints(template);
  if (selections.length === 0) {
    return false;
  }
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (ctx.isInspectorSectionActive("summary")) {
    ctx.setInspectorAppendSection("summary");
    appendMotionPathSummary(ctx, selections);
  }
  if (ctx.isInspectorSectionActive("timing")) {
    ctx.setInspectorAppendSection("timing");
    appendMotionPathPointControls(ctx, selections, effectiveTemplate);
  }
  if (ctx.isInspectorSectionActive("ownership")) {
    ctx.setInspectorAppendSection("ownership");
    appendMotionPathOwnership(ctx, selections);
  }
  return true;
}

function appendMotionPathSummary(ctx, selections): void {
  const single = selections.length === 1 ? selections[0] : null;
  ctx.appendInspectorRows(
    ctx.deps.t("viewer.inspector.motionPath.title", "Spatial motion points"),
    [
      [
        ctx.deps.t("viewer.inspector.motionPath.points", "Points"),
        String(selections.length),
      ],
      [
        ctx.deps.t("viewer.inspector.fields.layer", "Layer"),
        formatSelectionLayers(ctx, selections),
      ],
      [
        ctx.deps.t("viewer.inspector.fields.time", "Time"),
        single
          ? ctx.formatSeconds(single.point.time)
          : ctx.deps.t("viewer.inspector.keyframeSelection.mixed", "—"),
      ],
      [
        ctx.deps.t("viewer.inspector.motionPath.position", "Position"),
        single
          ? `${formatNumber(single.point.x)} · ${formatNumber(single.point.y)}`
          : ctx.deps.t("viewer.inspector.keyframeSelection.mixed", "—"),
      ],
    ],
  );
}

function appendMotionPathPointControls(
  ctx,
  selections,
  effectiveTemplate,
): void {
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = ctx.deps.t(
    "viewer.inspector.motionPath.spatialInterpolation",
    "Spatial interpolation",
  );
  const typeRow = document.createElement("label");
  typeRow.className = "inspector-row inspector-edit-row";
  const typeLabel = document.createElement("span");
  typeLabel.textContent = ctx.deps.t(
    "viewer.inspector.motionPath.pointType",
    "Point type",
  );
  const typeSelect = createPointKindSelect(ctx, selections, effectiveTemplate);
  typeRow.append(typeLabel, typeSelect);
  ctx.appendInspectorNode(heading, typeRow);
  if (selections.length === 1) {
    appendSinglePointFields(ctx, selections[0], effectiveTemplate);
  } else {
    const note = document.createElement("p");
    note.className = "inspector-capability-note";
    note.textContent = ctx.deps
      .t(
        "viewer.inspector.motionPath.bulkHint",
        "The point type applies to all {count} selected motion points.",
      )
      .replace("{count}", String(selections.length));
    ctx.appendInspectorNode(note);
  }
}

function createPointKindSelect(ctx, selections, effectiveTemplate) {
  const select = document.createElement("select");
  select.dataset.motionPathPointKind = "true";
  select.disabled = selections.some(
    ({ layer, point }) =>
      !ctx.canEditCanvasMotionPathPoint(layer, point, effectiveTemplate),
  );
  const kinds = new Set<MotionPathPointKind>(
    selections.map(({ point }) => point.kind),
  );
  if (kinds.size > 1) {
    const mixed = document.createElement("option");
    mixed.value = "";
    mixed.textContent = ctx.deps.t(
      "viewer.inspector.keyframeSelection.mixed",
      "—",
    );
    select.append(mixed);
  }
  for (const kind of POINT_KINDS) {
    const option = document.createElement("option");
    option.value = kind;
    option.textContent = getPointKindLabel(ctx, kind);
    select.append(option);
  }
  select.value = kinds.size === 1 ? [...kinds][0] : "";
  select.addEventListener("change", () => {
    if (!select.value) {
      return;
    }
    ctx.updateCanvasMotionPathPointKinds(
      selections.map(({ layer, point }) => ({
        layerId: layer.id,
        xKeyframeId: point.xKeyframeId,
        yKeyframeId: point.yKeyframeId,
      })),
      select.value,
    );
  });
  return select;
}

function appendSinglePointFields(ctx, selection, effectiveTemplate): void {
  const { layer, point } = selection;
  const editable = ctx.canEditCanvasMotionPathPoint(
    layer,
    point,
    effectiveTemplate,
  );
  for (const [property, label, value] of [
    ["x", "X", point.x],
    ["y", "Y", point.y],
  ]) {
    appendNumberField(
      ctx,
      label,
      value,
      (next) => {
        ctx.beginEditorCommand({
          payload: {
            layerId: layer.id,
            property,
            xKeyframeId: point.xKeyframeId,
            yKeyframeId: point.yKeyframeId,
          },
          type: "updateMotionPathPoint",
        });
        ctx.updateCanvasMotionPathPointPosition(
          layer.id,
          point.xKeyframeId,
          point.yKeyframeId,
          {
            x: property === "x" ? next : point.x,
            y: property === "y" ? next : point.y,
          },
        );
      },
      !editable,
    );
  }
  if (point.kind === "linear") {
    return;
  }
  for (const [side, tangent] of [
    ["in", point.inTangent],
    ["out", point.outTangent],
  ] as const) {
    for (const axis of ["x", "y"] as const) {
      appendNumberField(
        ctx,
        `${side === "in" ? "In" : "Out"} ${axis.toUpperCase()}`,
        tangent[axis],
        (next) => {
          ctx.beginEditorCommand({
            payload: {
              axis,
              layerId: layer.id,
              side,
              xKeyframeId: point.xKeyframeId,
              yKeyframeId: point.yKeyframeId,
            },
            type: "updateMotionPathTangent",
          });
          ctx.updateCanvasMotionPathTangent(
            layer.id,
            point.xKeyframeId,
            point.yKeyframeId,
            side,
            { ...tangent, [axis]: next },
          );
        },
        !editable,
      );
    }
  }
}

function appendNumberField(
  ctx,
  label,
  value,
  onChange,
  disabled = false,
): void {
  const row = document.createElement("label");
  row.className = "inspector-row inspector-edit-row";
  const name = document.createElement("span");
  name.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.step = "0.1";
  input.value = String(ctx.roundInspectorNumber(value));
  input.disabled = disabled;
  input.addEventListener("change", () => onChange(Number(input.value) || 0));
  row.append(name, input);
  ctx.appendInspectorNode(row);
}

function appendMotionPathOwnership(ctx, selections): void {
  ctx.appendInspectorRows(
    ctx.deps.t("viewer.inspector.ownership", "Ownership"),
    [
      [
        ctx.deps.t(
          "viewer.inspector.motionPath.coordinateTracks",
          "Coordinate tracks",
        ),
        String(
          new Set(
            selections.flatMap(({ model }) => [
              model.xTrack.id,
              model.yTrack.id,
            ]),
          ).size,
        ),
      ],
    ],
  );
}

function getPointKindLabel(ctx, kind: MotionPathPointKind): string {
  return ctx.deps.t(
    `viewer.inspector.motionPath.types.${kind}`,
    kind === "linear" ? "Linear" : kind === "smooth" ? "Smooth" : "Corner",
  );
}

function formatSelectionLayers(ctx, selections): string {
  const names = [
    ...new Set<string>(
      selections.map(({ layer }) => String(layer.name ?? layer.id)),
    ),
  ];
  return names.length === 1
    ? names[0]
    : ctx.deps
        .t("viewer.inspector.keyframeSelection.mixedCount", "{count} values")
        .replace("{count}", String(names.length));
}

function formatNumber(value): string {
  return (Math.round(Number(value) * 1000) / 1000).toString();
}

export function installInspectorMotionPathPointOwner(
  ctx: ViewerAppContext,
): void {
  ctx.appendMotionPathPointInspector = (...args: any[]) =>
    (appendMotionPathPointInspector as any)(ctx, ...args);
}
