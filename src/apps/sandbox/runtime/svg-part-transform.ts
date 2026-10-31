import type { SvgPartTransform } from "./svg-part-model.js";
import { clamp, ease } from "./math.js";

export function createSvgPartTransform(value: unknown = {}): SvgPartTransform {
  const args = isRecord(value) ? value : {};
  const mode = text(args.mode, "assemble");
  const reveal = clamp(numeric(args.reveal, 1), 0, 1);
  const spread = Math.max(0, numeric(args.spread, 0));
  const blur = Math.max(0, numeric(args.blur, 0));
  const stagger = clamp(numeric(args.stagger, 0.36), 0, 0.95);
  const orderMode = text(args.order, "document");
  const scaleFrom = numeric(args.scaleFrom, 0.92);
  const rotate = numeric(args.rotate, 0.28);
  return function svgPartTransform(part, index, parsed) {
    const count = Math.max(1, parsed?.parts?.length ?? 1);
    const order = resolveSvgPartOrder(index, count, orderMode);
    const start = count <= 1 ? 0 : (order / (count - 1)) * stagger;
    const available = Math.max(0.001, 1 - start);
    const p = ease(
      text(args.ease, "out"),
      clamp((reveal - start) / available, 0, 1),
    );
    const angle = numeric(args.angle, index * 2.399963);
    const distance = spread * (1 - p);
    const dir = index % 2 === 0 ? -1 : 1;
    const scatter = mode === "scatter" || mode === "shatter";
    return {
      alpha: p,
      filter:
        blur > 0 && p < 0.999
          ? `blur(${((1 - p) * blur).toFixed(2)}px)`
          : "none",
      ...(part.cx === undefined ? {} : { originX: part.cx }),
      ...(part.cy === undefined ? {} : { originY: part.cy }),
      rotate: scatter ? (1 - p) * dir * rotate : 0,
      scale: scaleFrom + (1 - scaleFrom) * p,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  };
}

function resolveSvgPartOrder(index: number, count: number, orderMode: string) {
  if (count <= 1) return 0;
  if (orderMode === "reverse") return count - index - 1;
  if (orderMode === "center") {
    const center = (count - 1) / 2;
    return Math.min(count - 1, Math.round(Math.abs(index - center) * 2));
  }
  if (orderMode === "edges") {
    return Math.min(
      count - 1,
      Math.round(Math.min(index, count - index - 1) * 2),
    );
  }
  if (orderMode === "random") return stablePartRank(index, count);
  return index;
}

function stablePartRank(index: number, count: number) {
  const value = ((index + 1) * 1103515245 + 12345) >>> 0;
  let rank = 0;
  for (let i = 0; i < count; i += 1) {
    const other = ((i + 1) * 1103515245 + 12345) >>> 0;
    if (other < value || (other === value && i < index)) {
      rank += 1;
    }
  }
  return rank;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function numeric(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}
