import type { ViewerAppContext } from "../app/context.js";
import type { CanvasMotionPathPoint } from "./motion-path-model.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export function appendMotionPathPoint(
  ctx: ViewerAppContext,
  group: SVGGElement,
  layerId: string,
  point: CanvasMotionPathPoint,
  stagePoint,
  index: number,
  count: number,
  selected: boolean,
  interactive: boolean,
  editable: boolean,
): void {
  const circle = document.createElementNS(SVG_NAMESPACE, "circle");
  circle.setAttribute(
    "class",
    `motion-path-point${selected ? " selected" : ""}${point.enabled ? "" : " disabled"}${interactive && !editable ? " blocked" : ""}`,
  );
  circle.setAttribute("cx", stagePoint.x.toFixed(2));
  circle.setAttribute("cy", stagePoint.y.toFixed(2));
  circle.setAttribute("r", index === 0 || index === count - 1 ? "6" : "5");
  circle.dataset.interactive = String(interactive);
  circle.dataset.layerId = layerId;
  circle.dataset.time = point.time.toFixed(3);
  circle.dataset.xKeyframeId = point.xKeyframeId;
  circle.dataset.yKeyframeId = point.yKeyframeId;
  if (interactive) {
    circle.setAttribute("pointer-events", "all");
    circle.setAttribute("role", "button");
    circle.setAttribute("tabindex", "0");
    circle.setAttribute("aria-disabled", String(!editable));
    circle.setAttribute(
      "aria-label",
      ctx.deps
        .t("viewer.canvas.motionPath.point", "Motion point at {time}")
        .replace("{time}", ctx.formatSeconds(point.time)),
    );
    circle.addEventListener("pointerdown", (event) => {
      if (ctx.beginOverlappingTransformHandleDrag(event)) {
        return;
      }
      ctx.beginMotionPathPointDrag(
        event,
        layerId,
        point.xKeyframeId,
        point.yKeyframeId,
      );
    });
    circle.addEventListener("keydown", (event) =>
      ctx.handleMotionPathPointKeydown(
        event,
        layerId,
        point.xKeyframeId,
        point.yKeyframeId,
      ),
    );
  }
  group.append(circle);
}

export function appendMotionPathTangents(
  ctx: ViewerAppContext,
  group: SVGGElement,
  layerId: string,
  point: CanvasMotionPathPoint,
  stagePoint,
  viewport,
): void {
  for (const side of ["in", "out"] as const) {
    const tangent = point[`${side}Tangent`];
    if (Math.hypot(tangent.x, tangent.y) < 0.0001) {
      continue;
    }
    const handlePoint = getMotionPathTangentStagePoint(
      stagePoint,
      tangent,
      viewport,
    );
    const line = document.createElementNS(SVG_NAMESPACE, "line");
    line.setAttribute("class", "motion-path-tangent-line");
    line.setAttribute("x1", stagePoint.x.toFixed(2));
    line.setAttribute("y1", stagePoint.y.toFixed(2));
    line.setAttribute("x2", handlePoint.x.toFixed(2));
    line.setAttribute("y2", handlePoint.y.toFixed(2));
    group.append(line);
    const handle = document.createElementNS(SVG_NAMESPACE, "circle");
    handle.setAttribute("class", "motion-path-tangent-handle");
    handle.setAttribute("cx", handlePoint.x.toFixed(2));
    handle.setAttribute("cy", handlePoint.y.toFixed(2));
    handle.setAttribute("r", "4.5");
    handle.setAttribute("pointer-events", "all");
    handle.setAttribute("role", "button");
    handle.setAttribute("tabindex", "0");
    handle.setAttribute(
      "aria-label",
      ctx.deps
        .t(
          `viewer.canvas.motionPath.${side}Tangent`,
          side === "in"
            ? "Incoming motion tangent at {time}"
            : "Outgoing motion tangent at {time}",
        )
        .replace("{time}", ctx.formatSeconds(point.time)),
    );
    handle.dataset.layerId = layerId;
    handle.dataset.side = side;
    handle.dataset.xKeyframeId = point.xKeyframeId;
    handle.dataset.yKeyframeId = point.yKeyframeId;
    handle.addEventListener("pointerdown", (event) =>
      ctx.beginMotionPathTangentDrag(
        event,
        layerId,
        point.xKeyframeId,
        point.yKeyframeId,
        side,
      ),
    );
    handle.addEventListener("keydown", (event) =>
      ctx.handleMotionPathTangentKeydown(
        event,
        layerId,
        point.xKeyframeId,
        point.yKeyframeId,
        side,
      ),
    );
    group.append(handle);
  }
}

export function getMotionPathTangentStagePoint(point, tangent, viewport) {
  return {
    x: point.x + tangent.x * viewport.scaleX,
    y: point.y + tangent.y * viewport.scaleY,
  };
}
