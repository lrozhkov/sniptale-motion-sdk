import type { RuntimeCanvasContext, RuntimeCanvas } from "./canvas-model.js";
import type {
  TextDrawOptions,
  CodeBlockDrawOptions,
  PathDrawOptions,
  ParticlesDrawOptions,
  CodeLine,
} from "./canvas-drawing-model.js";
import { clamp, roundRect } from "./math.js";

export function drawText(
  context: RuntimeCanvasContext,
  args?: TextDrawOptions | null,
): void {
  const {
    alpha,
    color = "#ffffff",
    font = "800 64px Inter, Arial, sans-serif",
    letterSpacing = 0,
    maxWidth,
    text = "",
    x = 0,
    y = 0,
    align = "left",
    baseline = "alphabetic",
    shadowBlur = 0,
    shadowColor = color,
  } = args ?? {};
  context.save();
  context.globalAlpha *= Number(alpha ?? args?.opacity ?? 1);
  context.fillStyle = color;
  context.font = font;
  context.textAlign = align;
  context.textBaseline = baseline;
  context.shadowColor = shadowColor;
  context.shadowBlur = shadowBlur;
  if (!letterSpacing) {
    context.fillText(String(text), x, y, maxWidth);
  } else {
    let cursor = x;
    const chars = String(text).split("");
    for (const char of chars) {
      context.fillText(char, cursor, y);
      cursor += context.measureText(char).width + letterSpacing;
    }
  }
  context.restore();
}

export function drawCodeBlock(
  context: RuntimeCanvasContext,
  args?: CodeBlockDrawOptions | null,
): void {
  const {
    lines = [],
    x = 80,
    y = 100,
    width = 760,
    lineHeight = 30,
    font = "600 22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    focusLine = -1,
    progress = 1,
    accent = "#7cf7ff",
  } = args ?? {};
  context.save();
  roundRect(context, x, y, width, lineHeight * (lines.length + 1.6), 16);
  context.fillStyle = "rgba(9,14,22,0.88)";
  context.fill();
  context.strokeStyle = "rgba(124,247,255,0.28)";
  context.stroke();
  context.font = font;
  context.textBaseline = "middle";
  const visible = Math.ceil(lines.length * clamp(progress, 0, 1));
  for (let i = 0; i < visible; i += 1) {
    const rowY = y + 44 + i * lineHeight;
    if (i === focusLine) {
      context.fillStyle = "rgba(124,247,255,0.11)";
      context.fillRect(
        x + 12,
        rowY - lineHeight * 0.48,
        width - 24,
        lineHeight,
      );
    }
    context.fillStyle = "rgba(132,147,166,0.82)";
    context.fillText(String(i + 1).padStart(2, "0"), x + 24, rowY);
    drawCodeTokens(context, lines[i], x + 76, rowY, accent);
  }
  context.restore();
}

export function drawPath(
  context: RuntimeCanvasContext,
  args?: PathDrawOptions | null,
): void {
  const {
    points = [],
    progress = 1,
    color = "#7cf7ff",
    closed = false,
    fill = "none",
    width = 3,
    alpha,
    glow = 0,
    startProgress = 0,
  } = args ?? {};
  if (points.length < 2) return;
  const maxIndex = Math.max(
    1,
    Math.floor((points.length - 1) * clamp(progress, 0, 1)),
  );
  const minIndex = Math.min(
    maxIndex - 1,
    Math.floor((points.length - 1) * clamp(startProgress, 0, 1)),
  );
  const opacity = Number(alpha ?? args?.opacity ?? 1);
  context.save();
  context.globalAlpha *= opacity;
  context.strokeStyle = color;
  context.fillStyle = fill;
  context.lineWidth = width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = color;
  context.shadowBlur = glow;
  context.beginPath();
  context.moveTo(points[minIndex].x, points[minIndex].y);
  for (let i = minIndex + 1; i <= maxIndex; i += 1) {
    const current = points[i];
    const previous = points[i - 1];
    context.quadraticCurveTo(
      previous.x,
      previous.y,
      (previous.x + current.x) * 0.5,
      (previous.y + current.y) * 0.5,
    );
  }
  if (closed) {
    context.closePath();
  }
  if (fill && fill !== "none") {
    context.fill();
  }
  context.stroke();
  context.restore();
}

export function drawParticles(
  context: RuntimeCanvasContext,
  args?: ParticlesDrawOptions | null,
): void {
  const canvas: RuntimeCanvas = context.canvas;
  const {
    count = 80,
    progress = 0,
    width = canvas.__sniptaleLogicalWidth ?? canvas.width,
    height = canvas.__sniptaleLogicalHeight ?? canvas.height,
    color = "#7cf7ff",
    alpha,
    seed = 1,
  } = args ?? {};
  const opacity = Number(alpha ?? args?.opacity ?? 0.35);
  context.save();
  context.fillStyle = color;
  for (let i = 0; i < count; i += 1) {
    const n = Math.sin((i + 1) * 127.1 + seed * 311.7) * 43758.5453;
    const r = n - Math.floor(n);
    const x = (r * width + progress * width * (0.12 + (i % 5) * 0.01)) % width;
    const y =
      ((Math.sin(i * 19.19 + seed) * 0.5 + 0.5) * height +
        Math.sin(progress * 6 + i) * 18) %
      height;
    context.globalAlpha = opacity * (0.35 + 0.65 * ((i % 7) / 6));
    context.fillRect(x, y, 1.4, 1.4);
  }
  context.restore();
}

function drawCodeTokens(
  context: RuntimeCanvasContext,
  line: CodeLine,
  x: number,
  y: number,
  accent: string,
) {
  const tokens = Array.isArray(line)
    ? line
    : [{ text: String(line), color: "#dbeafe" }];
  let cursor = x;
  for (const token of tokens) {
    context.fillStyle = token.color || accent;
    context.fillText(token.text, cursor, y);
    cursor += context.measureText(token.text).width;
  }
}
