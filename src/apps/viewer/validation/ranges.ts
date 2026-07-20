export function isRangeInvalid(start, duration, totalDuration): boolean {
  return (
    start < 0 || duration <= 0 || start + duration > totalDuration + 0.0001
  );
}
