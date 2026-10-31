export type InspectorNumberField<P extends string = string> = {
  label: string;
  property: P;
  min: number;
  max: number;
  step: number;
};
export type InspectorLocalizedNumberField<P extends string = string> = Omit<
  InspectorNumberField<P>,
  "label"
> & { labelKey?: string; labelFallback: string };
type InspectorFieldBase = {
  label: string;
  property: string;
  refreshInspector?: boolean;
};
export type InspectorLayerField = InspectorFieldBase &
  (
    | {
        kind: "number";
        defaultValue: number;
        min: number;
        max: number;
        step: number;
      }
    | { kind: "text" | "color"; defaultValue: string }
    | { kind: "select"; defaultValue: string; options: readonly string[] }
    | { kind: "boolean"; defaultValue: boolean }
  );
export function readInspectorNumber(
  value: unknown,
  range: Pick<InspectorNumberField, "min" | "max">,
): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(range.max, Math.max(range.min, value))
    : null;
}
