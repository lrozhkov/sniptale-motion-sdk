import {
  isRecord,
  rejectUnknownKeys,
  requirePositiveNumber,
} from "./validation-shared.js";
import type { createEffectV1Diagnostics } from "./diagnostics.js";
import { EFFECT_V1_OBJECT_MAX_SIZE } from "./object-layout.js";
import { validateEffectV1ObjectHandles } from "./object-handles-validation.js";

export function validateEffectV1ObjectLayout(
  input: unknown,
  kind: unknown,
  report: ReturnType<typeof createEffectV1Diagnostics>,
  controls?: unknown,
): void {
  if (input === undefined) return;
  if (!isRecord(input)) {
    report.error(
      "OBJECT_LAYOUT_TYPE",
      "$.objectLayout",
      "Expected an object layout.",
    );
    return;
  }
  if (kind !== "standalone") {
    report.error(
      "OBJECT_LAYOUT_KIND",
      "$.objectLayout",
      "Only standalone effects can declare an object layout.",
    );
  }
  rejectUnknownKeys(
    input,
    new Set(["width", "height", "resize", "handles"]),
    "$.objectLayout",
    report,
  );
  requirePositiveNumber(input.width, "$.objectLayout.width", report);
  validateEffectV1ObjectHandles(input.handles, input.resize, controls, report);
  requirePositiveNumber(input.height, "$.objectLayout.height", report);
  for (const key of ["width", "height"] as const) {
    if (
      typeof input[key] === "number" &&
      (input[key] < 1 || input[key] > EFFECT_V1_OBJECT_MAX_SIZE)
    ) {
      report.error(
        "OBJECT_LAYOUT_SIZE",
        `$.objectLayout.${key}`,
        "Expected a dimension between 1 and 16384.",
      );
    }
  }
  if (input.resize !== "scale" && input.resize !== "reflow") {
    report.error(
      "OBJECT_LAYOUT_RESIZE",
      "$.objectLayout.resize",
      "Expected scale or reflow.",
    );
  }
}
