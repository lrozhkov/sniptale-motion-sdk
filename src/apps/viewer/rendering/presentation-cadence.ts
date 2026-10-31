import type { ViewerAppContext } from "../app/context.js";

export function recordDirectPreviewPresentation(
  ctx: ViewerAppContext,
  presentedAtMs: unknown,
  presentedAtEpochMs: unknown,
  receivedAtMs: unknown = performance.now(),
  localTimeOriginMs: unknown = performance.timeOrigin,
): void {
  const timestamp = typeof presentedAtMs === "number" ? presentedAtMs : NaN;
  const epochTimestamp =
    typeof presentedAtEpochMs === "number" ? presentedAtEpochMs : NaN;
  const receivedTimestamp =
    typeof receivedAtMs === "number" ? receivedAtMs : NaN;
  const localTimeOrigin =
    typeof localTimeOriginMs === "number" ? localTimeOriginMs : NaN;
  if (
    !Number.isFinite(timestamp) ||
    timestamp < 0 ||
    !Number.isFinite(receivedTimestamp) ||
    receivedTimestamp < 0
  ) {
    return;
  }
  const translatedTimestamp = epochTimestamp - localTimeOrigin;
  const localPresentationTimestamp =
    Number.isFinite(translatedTimestamp) &&
    translatedTimestamp >= 0 &&
    translatedTimestamp <= receivedTimestamp + 5
      ? translatedTimestamp
      : receivedTimestamp;
  const previous = ctx.state.lastDirectPresentationAtMs;
  if (typeof previous === "number" && timestamp > previous) {
    const intervals = ctx.state.directPresentationIntervalsMs;
    intervals.push(timestamp - previous);
    if (intervals.length > 240) {
      intervals.splice(0, intervals.length - 240);
    }
  }
  ctx.state.lastDirectPresentationAtMs = timestamp;
  ctx.state.lastDirectPresentationLocalAtMs = Math.max(
    ctx.state.lastDirectPresentationLocalAtMs ?? 0,
    localPresentationTimestamp,
  );
}
