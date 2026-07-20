import type { ViewerAppContext } from "../app/context.js";

export function recordDirectPreviewPresentation(
  ctx: ViewerAppContext,
  presentedAtMs: unknown,
  presentedAtEpochMs: unknown,
  receivedAtMs: unknown = performance.now(),
  localTimeOriginMs: unknown = performance.timeOrigin,
): void {
  const timestamp = Number(presentedAtMs);
  const epochTimestamp = Number(presentedAtEpochMs);
  const receivedTimestamp = Number(receivedAtMs);
  const localTimeOrigin = Number(localTimeOriginMs);
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
    const intervals = ctx.state.directPresentationIntervalsMs as number[];
    intervals.push(timestamp - previous);
    if (intervals.length > 240) {
      intervals.splice(0, intervals.length - 240);
    }
  }
  ctx.state.lastDirectPresentationAtMs = timestamp;
  ctx.state.lastDirectPresentationLocalAtMs = Math.max(
    Number(ctx.state.lastDirectPresentationLocalAtMs) || 0,
    localPresentationTimestamp,
  );
}
