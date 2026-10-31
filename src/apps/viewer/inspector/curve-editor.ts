import { bindViewerAction } from "../app/bind-action.js";
import type { TimelineKeyframe } from "../../../sdk/types.js";
import type {
  InspectorKeyframeActions,
  InspectorCurvePoint,
  InspectorCurveFieldOptions,
} from "./keyframe-contract.js";
import { createTimelineDragPreview } from "../timeline/interaction/drag-preview.js";
import { readInspectorNumber } from "./field-model.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  getKeyframeEasingLabel,
  KEYFRAME_EASING_PRESETS,
} from "./keyframe-labels.js";
import { resolveTimelineEase } from "../../../sdk/timeline/easing.js";

function createCurveSvg(
  ctx: ViewerAppContext,
  trackId: string,
  keyframeId: string,
  keyframe: TimelineKeyframe<unknown>,
) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "curve-svg");
  svg.setAttribute("viewBox", "0 0 240 94");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    ctx.deps.t("viewer.inspector.keyframeCurve", "Keyframe Curve"),
  );
  const start = { x: 18, y: 76 };
  const end = { x: 222, y: 18 };
  const handles = ctx.deps.normalizeHandles(keyframe.handles);
  const h1 = {
    x: start.x + handles.x1 * (end.x - start.x),
    y: start.y - handles.y1 * (start.y - end.y),
  };
  const h2 = {
    x: start.x + handles.x2 * (end.x - start.x),
    y: start.y - handles.y2 * (start.y - end.y),
  };
  const points = Array.from({ length: 49 }, (_, index) => {
    const progress = index / 48;
    const eased = resolveTimelineEase(keyframe, progress);
    return {
      x: start.x + progress * (end.x - start.x),
      y: start.y - eased * (start.y - end.y),
    };
  });
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
      .join(" "),
  );
  path.setAttribute("class", "curve-path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-width", "3");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  if (keyframe.easing === "bezier") {
    const guide = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    guide.setAttribute(
      "d",
      `M${start.x},${start.y} L${h1.x},${h1.y} M${end.x},${end.y} L${h2.x},${h2.y}`,
    );
    guide.setAttribute("class", "curve-guide");
    guide.setAttribute("fill", "none");
    guide.setAttribute("stroke-width", "1");
    svg.append(
      guide,
      ctx.createCurveHandle(trackId, keyframeId, "first", h1, start, end),
      ctx.createCurveHandle(trackId, keyframeId, "second", h2, start, end),
    );
  }
  return svg;
}

function createCurveHandle(
  ctx: ViewerAppContext,
  trackId: string,
  keyframeId: string,
  handleName: "first" | "second",
  point: InspectorCurvePoint,
  start: InspectorCurvePoint,
  end: InspectorCurvePoint,
): SVGCircleElement {
  const circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  circle.setAttribute("class", `curve-handle curve-handle-${handleName}`);
  circle.setAttribute("cx", String(point.x));
  circle.setAttribute("cy", String(point.y));
  circle.setAttribute("r", "6");
  circle.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const template = ctx.state.currentTemplate;
    const svg = circle.ownerSVGElement;
    if (!template || !svg) return;
    const rect = svg.getBoundingClientRect();
    const startX = event.clientX,
      startY = event.clientY;
    const preview = createTimelineDragPreview(ctx, template);
    const onMove = (moveEvent: MouseEvent) => {
      if (
        !preview.activate(
          Math.abs(moveEvent.clientX - startX) +
            Math.abs(moveEvent.clientY - startY),
          () =>
            ctx.beginEditorCommand({
              payload: { handleName, keyframeId, trackId },
              type: "updateKeyframe",
            }),
        )
      )
        return;
      const x = ctx.deps.clamp(
        (moveEvent.clientX - rect.left) / Math.max(1, rect.width),
        0,
        1,
      );
      const y = ctx.deps.clamp(
        (moveEvent.clientY - rect.top) / Math.max(1, rect.height),
        0,
        1,
      );
      const normalized = {
        x: ctx.deps.clamp((x * 240 - start.x) / (end.x - start.x), 0, 1),
        y: ctx.deps.clamp((start.y - y * 94) / (start.y - end.y), 0, 1),
      };
      preview.scheduleUpdate(
        () => {
          void ctx.updateSelectedKeyframe(
            handleName === "first"
              ? { handles: { x1: normalized.x, y1: normalized.y } }
              : { handles: { x2: normalized.x, y2: normalized.y } },
            trackId,
            keyframeId,
            { history: false, render: false, timeline: false },
          );
        },
        () => ctx.renderInspector(),
      );
    };
    ctx.bindPointerDrag(null, circle, onMove, () => preview.finalize());
  });
  return circle;
}

function createCurveNumberField(
  _ctx: ViewerAppContext,
  labelText: string,
  value: number,
  onInput: (value: number) => void,
  options: InspectorCurveFieldOptions = {},
): HTMLLabelElement {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = "number";
  input.step = "0.01";
  if (options.min !== undefined) input.min = String(options.min);
  if (options.max !== undefined) input.max = String(options.max);
  if (options.trackId) input.dataset.trackId = options.trackId;
  if (options.keyframeId) input.dataset.keyframeId = options.keyframeId;
  if (options.keyframeProperty)
    input.dataset.keyframeProperty = options.keyframeProperty;
  input.value = String(value);
  input.addEventListener("change", () => {
    const next = readInspectorNumber(input.valueAsNumber, {
      min: options.min ?? -Infinity,
      max: options.max ?? Infinity,
    });
    if (next === null) {
      input.value = String(value);
      return;
    }
    onInput(next);
  });
  label.append(input);
  return label;
}

function createEasingField(
  ctx: ViewerAppContext,
  keyframe: TimelineKeyframe<unknown>,
  trackId = ctx.getPrimaryKeyframeSelection()?.trackId,
  keyframeId = ctx.getPrimaryKeyframeSelection()?.keyframeId,
) {
  const label = document.createElement("label");
  label.className = "keyframe-easing-field";
  const name = document.createElement("span");
  name.textContent = ctx.deps.t("viewer.fields.easing", "Easing");
  const select = document.createElement("select");
  if (trackId) {
    select.dataset.trackId = trackId;
  }
  if (keyframeId) {
    select.dataset.keyframeId = keyframeId;
  }
  select.dataset.keyframeProperty = "easing";
  for (const easing of KEYFRAME_EASING_PRESETS) {
    const option = document.createElement("option");
    option.value = easing;
    option.textContent = getKeyframeEasingLabel(ctx, easing);
    select.append(option);
  }
  select.value = keyframe.easing ?? "linear";
  select.addEventListener("change", () =>
    ctx.updateKeyframeEasing(select.value, trackId, keyframeId),
  );
  label.append(name, select);
  return label;
}

function updateKeyframeEasing(
  ctx: ViewerAppContext,
  easing: string,
  trackId?: string,
  keyframeId?: string,
) {
  if (!KEYFRAME_EASING_PRESETS.some((value) => value === easing)) return;
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const selectedRefs = ctx.getSelectedKeyframeRefs();
  const includesPrimary = selectedRefs.some(
    (ref) => ref.trackId === trackId && ref.keyframeId === keyframeId,
  );
  const targetRefs = includesPrimary
    ? selectedRefs
    : trackId && keyframeId
      ? [{ keyframeId, trackId }]
      : [];
  if (!template || targetRefs.length === 0) {
    return;
  }
  ctx.applyEditorCommand(
    {
      payload: { easing, keyframes: targetRefs },
      type: "updateKeyframeEasing",
    },
    () => {
      for (const ref of targetRefs) {
        const track = timeline.tracks.find((item) => item.id === ref.trackId);
        const keyframe = track?.keyframes.find(
          (item) => item.id === ref.keyframeId,
        );
        if (!keyframe) {
          continue;
        }
        keyframe.easing = easing;
        const handles = ctx.deps.normalizeHandles(keyframe.handles);
        if (
          easing === "bezier" &&
          handles.x1 === 0 &&
          handles.y1 === 0 &&
          handles.x2 === 0 &&
          handles.y2 === 0
        ) {
          keyframe.handles = { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 };
        }
      }
      ctx.state.timelineOverrides.set(
        template.id,
        ctx.deps.normalizeTimeline(
          timeline,
          ctx.getEffectiveDuration(template),
        ),
      );
      ctx.renderTimelineEditor(template);
      void ctx.renderCurrentFrame();
    },
  );
}

export function createInspectorCurveEditorActions(
  getContext: () => ViewerAppContext,
): Pick<
  InspectorKeyframeActions,
  | "createCurveSvg"
  | "createCurveHandle"
  | "createCurveNumberField"
  | "createEasingField"
  | "updateKeyframeEasing"
> {
  return {
    createCurveSvg: bindViewerAction(createCurveSvg, getContext),
    createCurveHandle: bindViewerAction(createCurveHandle, getContext),
    createCurveNumberField: bindViewerAction(
      createCurveNumberField,
      getContext,
    ),
    createEasingField: bindViewerAction(createEasingField, getContext),
    updateKeyframeEasing: bindViewerAction(updateKeyframeEasing, getContext),
  };
}
