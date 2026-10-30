import type { ViewerAppContext } from "./context.js";

function normalizePrecision(value: unknown): number {
  return Math.min(6, Math.max(0, Math.round(Number(value) || 0)));
}

function getSecondsUnit(ctx: ViewerAppContext): string {
  return ctx.deps.t("viewer.time.secondsUnit", "s");
}

function formatSeconds(
  ctx: ViewerAppContext,
  value: unknown,
  precision = 3,
): string {
  const seconds = Number(value);
  return `${(Number.isFinite(seconds) ? seconds : 0).toFixed(
    normalizePrecision(precision),
  )}${getSecondsUnit(ctx)}`;
}

function formatSecondsRange(
  ctx: ViewerAppContext,
  start: unknown,
  end: unknown,
  precision = 3,
): string {
  const startSeconds = Number(start);
  const endSeconds = Number(end);
  const digits = normalizePrecision(precision);
  return `${(Number.isFinite(startSeconds) ? startSeconds : 0).toFixed(
    digits,
  )}-${(Number.isFinite(endSeconds) ? endSeconds : 0).toFixed(
    digits,
  )}${getSecondsUnit(ctx)}`;
}

export function installAppTimeFormatOwner(ctx: ViewerAppContext): void {
  ctx.formatSeconds = formatSeconds.bind(undefined, ctx);
  ctx.formatSecondsRange = formatSecondsRange.bind(undefined, ctx);
}
