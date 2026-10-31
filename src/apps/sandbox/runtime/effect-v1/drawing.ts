import { effectV1Text } from "./expression.js";
import { isRecord, n, type RenderState, v, valueOr } from "./model.js";
import { drawCanvasPathSegments, trimPolyline } from "./path-drawing.js";
import { getLogicalCanvasScale } from "../logical-canvas.js";
import {
  recordCenteredPrimitiveRect,
  recordPolylinePrimitive,
  recordRotatedPrimitiveRect,
  recordSegmentPathPrimitive,
  recordTextPrimitive,
} from "./primitive-geometry.js";

export function drawShape(command: any, layer: any, state: RenderState): void {
  const c = state.context;
  withCommandStyle(command, layer, state, () => {
    const x = n(command.x, state);
    const y = n(command.y, state);
    const width = n(command.width, state);
    const height = n(command.height, state);
    c.translate(x + width / 2, y + height / 2);
    c.rotate(n(command.rotation, state));
    recordCenteredPrimitiveRect(command, state, width, height);
    c.beginPath();
    switch (command.shape) {
      case "circle":
        c.arc(0, 0, Math.min(width, height) / 2, 0, Math.PI * 2);
        break;
      case "ellipse":
        c.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
        break;
      case "diamond":
        c.moveTo(0, -height / 2);
        c.lineTo(width / 2, 0);
        c.lineTo(0, height / 2);
        c.lineTo(-width / 2, 0);
        c.closePath();
        break;
      case "roundRect":
        c.roundRect(
          -width / 2,
          -height / 2,
          width,
          height,
          n(command.radius, state),
        );
        break;
      default:
        c.rect(-width / 2, -height / 2, width, height);
    }
    paintPath(command, state);
  });
}

export function drawText(command: any, layer: any, state: RenderState): void {
  const c = state.context;
  withCommandStyle(command, layer, state, () => {
    c.fillStyle = resolvePaint(command.fill ?? "#fff", c, state);
    c.textAlign = String(command.align ?? "left");
    c.textBaseline = String(command.baseline ?? "alphabetic");
    const size = valueOr(command.fontSize, 16, state);
    const fontFamily = effectV1Text(
      v(command.fontFamily ?? "system-ui", state),
    );
    const fontWeight = effectV1Text(v(command.fontWeight ?? 400, state));
    c.font = `${command.fontStyle ?? "normal"} ${fontWeight} ${size}px ${fontFamily}`;
    const text = effectV1Text(v(command.text ?? "", state));
    const maxWidth = n(command.maxWidth, state);
    const x = n(command.x, state);
    const y = n(command.y, state);
    const reveal = Math.max(0, Math.min(1, valueOr(command.reveal, 1, state)));
    const measuredWidth = Math.min(
      Number(c.measureText(text).width) || 0,
      maxWidth > 0 ? maxWidth : Number.POSITIVE_INFINITY,
    );
    recordTextPrimitive(command, state, {
      font: c.font,
      measuredWidth,
      text,
      x,
      y,
    });
    const left = textLeft(x, measuredWidth, String(command.align ?? "left"));
    if (reveal < 1) {
      c.save();
      c.beginPath();
      c.rect(left - 2, y - size, measuredWidth * reveal + 4, size * 2);
      c.clip();
      fillText(c, text, x, y, maxWidth);
      c.restore();
    } else {
      fillText(c, text, x, y, maxWidth);
    }
    if (
      command.caret === true &&
      reveal > 0 &&
      reveal < 0.995 &&
      c.globalAlpha > 0.1
    ) {
      c.save();
      c.globalAlpha *= 0.82;
      c.fillRect(
        left + measuredWidth * reveal + 4,
        y - size * 0.48,
        2,
        size * 0.96,
      );
      c.restore();
    }
  });
}

function fillText(
  context: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
): void {
  if (maxWidth > 0) context.fillText(text, x, y, maxWidth);
  else context.fillText(text, x, y);
}

function textLeft(x: number, width: number, align: string): number {
  if (align === "center") return x - width * 0.5;
  if (align === "right" || align === "end") return x - width;
  return x;
}

export function drawImage(command: any, layer: any, state: RenderState): void {
  const input = command.input
    ? state.scope.context.inputFrames?.[String(command.input)]
    : null;
  const asset = input
    ? { bitmap: input }
    : state.scope.context.assets?.[String(command.assetId)];
  if (!asset?.bitmap) return;
  withCommandStyle(command, layer, state, () => {
    recordRotatedPrimitiveRect(command, state);
    state.runtime.drawImageAsset(state.context, asset, {
      alpha: 1,
      composite: state.context.globalCompositeOperation,
      filter: state.context.filter,
      fit: command.fit ?? "contain",
      height: n(command.height, state),
      rotate: n(command.rotation, state),
      shadowBlur: state.context.shadowBlur,
      shadowColor: state.context.shadowColor,
      width: n(command.width, state),
      x: n(command.x, state),
      y: n(command.y, state),
    });
  });
}

export function drawPath(command: any, layer: any, state: RenderState): void {
  if (Array.isArray(command.segments)) {
    drawSegmentPath(command, layer, state);
    return;
  }
  const points = Array.isArray(command.points)
    ? command.points.map((point: any) => ({
        x: n(point?.x, state),
        y: n(point?.y, state),
      }))
    : [];
  if (points.length < 2) return;
  const visible = trimPolyline(points, valueOr(command.progress, 1, state));
  const first = visible[0];
  if (!first) return;
  withCommandStyle(command, layer, state, () => {
    const c = state.context;
    recordPolylinePrimitive(command, state, visible);
    c.beginPath();
    c.moveTo(first.x, first.y);
    for (const point of visible.slice(1)) c.lineTo(point.x, point.y);
    if (command.closed === true) c.closePath();
    paintPath(command, state);
  });
}

function drawSegmentPath(command: any, layer: any, state: RenderState): void {
  if (command.segments.length === 0) return;
  withCommandStyle(command, layer, state, () => {
    recordSegmentPathPrimitive(command, state);
    drawCanvasPathSegments(command, state);
    paintPath(command, state);
  });
}

function paintPath(command: any, state: RenderState): void {
  const c = state.context;
  if (command.fill != null) {
    c.fillStyle = resolvePaint(command.fill, c, state);
    c.fill();
  }
  if (command.stroke != null) {
    c.strokeStyle = resolvePaint(command.stroke, c, state);
    c.lineWidth = valueOr(command.lineWidth, 1, state);
    c.lineCap = command.lineCap ?? "butt";
    c.lineJoin = command.lineJoin ?? "miter";
    c.stroke();
  }
}

export function withCommandStyle(
  command: any,
  layer: any,
  state: RenderState,
  draw: () => void,
): void {
  const c = state.context;
  c.save();
  try {
    c.globalAlpha *=
      valueOr(command.alpha, 1, state) * valueOr(layer?.opacity, 1, state);
    if (command.blend !== undefined) {
      c.globalCompositeOperation = sanitizeBlend(String(command.blend));
    }
    if (command.filter !== undefined) {
      c.filter = resolveFilter(command.filter, state);
    }
    if (command.shadow !== undefined) applyShadow(command.shadow, state);
    c.translate(valueOr(layer?.x, 0, state), valueOr(layer?.y, 0, state));
    draw();
  } finally {
    c.restore();
  }
}

export async function withSavedState(
  command: any,
  layer: any,
  state: RenderState,
  draw: () => Promise<void>,
): Promise<void> {
  const c = state.context;
  c.save();
  try {
    c.globalAlpha *=
      valueOr(command.alpha, 1, state) * valueOr(layer?.opacity, 1, state);
    if (command.blend !== undefined) {
      c.globalCompositeOperation = sanitizeBlend(String(command.blend));
    }
    if (command.filter !== undefined) {
      c.filter = resolveFilter(command.filter, state);
    }
    if (command.shadow !== undefined) applyShadow(command.shadow, state);
    c.translate(valueOr(layer?.x, 0, state), valueOr(layer?.y, 0, state));
    await draw();
  } finally {
    c.restore();
  }
}

function applyShadow(value: unknown, state: RenderState): void {
  if (!isRecord(value)) return;
  const scale = getLogicalCanvasScale(state.context);
  state.context.shadowBlur = n(value.blur, state) * scale.uniform;
  state.context.shadowColor = effectV1Text(
    v(value.color ?? "transparent", state),
  );
  state.context.shadowOffsetX = n(value.x, state) * scale.x;
  state.context.shadowOffsetY = n(value.y, state) * scale.y;
}

export function resolvePaint(value: unknown, c: any, state: RenderState): any {
  if (!isRecord(value) || value.op) return effectV1Text(v(value, state));
  if (value.kind === "linearGradient" || value.kind === "radialGradient") {
    const gradient =
      value.kind === "linearGradient"
        ? c.createLinearGradient(
            n(value.x0, state),
            n(value.y0, state),
            n(value.x1, state),
            n(value.y1, state),
          )
        : c.createRadialGradient(
            n(value.x0, state),
            n(value.y0, state),
            n(value.r0, state),
            n(value.x1, state),
            n(value.y1, state),
            n(value.r1, state),
          );
    for (const stop of Array.isArray(value.stops) ? value.stops : []) {
      gradient.addColorStop(
        n(stop.offset, state),
        effectV1Text(v(stop.color, state)),
      );
    }
    return gradient;
  }
  return String(value.color ?? "transparent");
}

export function resolveFilter(value: unknown, state: RenderState): string {
  if (!isRecord(value)) return "none";
  const parts: string[] = [];
  if (value.blur !== undefined) {
    const scale = getLogicalCanvasScale(state.context).uniform;
    parts.push(`blur(${Math.max(0, n(value.blur, state) * scale)}px)`);
  }
  if (value.brightness !== undefined) {
    parts.push(`brightness(${Math.max(0, n(value.brightness, state))})`);
  }
  if (value.saturate !== undefined) {
    parts.push(`saturate(${Math.max(0, n(value.saturate, state))})`);
  }
  return parts.join(" ") || "none";
}

function sanitizeBlend(value: string): any {
  if (
    ![
      "source-over",
      "screen",
      "lighter",
      "source-atop",
      "destination-in",
    ].includes(value)
  )
    throw new Error(`Unsupported Effect v1 blend: ${value}`);
  return value;
}
