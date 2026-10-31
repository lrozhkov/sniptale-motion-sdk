const METRICS = ["lines", "statements", "functions", "branches"] as const;

export function readCoverageReport(value: unknown): string {
  if (!isRecord(value) || !isRecord(value.total))
    throw new Error("Coverage summary does not include total metrics.");
  const total = value.total;
  return METRICS.map((metric) => {
    const entry = total[metric];
    if (
      !isRecord(entry) ||
      typeof entry.pct !== "number" ||
      !Number.isFinite(entry.pct) ||
      entry.pct < 0 ||
      entry.pct > 100
    )
      throw new Error(
        `Coverage summary has no valid percentage for ${metric}.`,
      );
    return `${metric}=${entry.pct}%`;
  }).join(", ");
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
