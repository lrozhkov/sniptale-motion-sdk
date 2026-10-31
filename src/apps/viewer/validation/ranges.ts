export function isRangeInvalid(
  start: unknown,
  duration: unknown,
  totalDuration: unknown,
): boolean {
  return (
    typeof start !== "number" ||
    !Number.isFinite(start) ||
    typeof duration !== "number" ||
    !Number.isFinite(duration) ||
    typeof totalDuration !== "number" ||
    !Number.isFinite(totalDuration) ||
    start < 0 ||
    duration <= 0 ||
    start + duration > totalDuration + 0.0001
  );
}
