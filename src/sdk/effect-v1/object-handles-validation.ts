import { EFFECT_V1_HANDLE_MAX_COORDINATE } from "./object-handles.js";
import {
  isRecord,
  rejectUnknownKeys,
  requireIdentifier,
  validateLocaleText,
} from "./validation-shared.js";
import type { createEffectV1Diagnostics } from "./diagnostics.js";

export function validateEffectV1ObjectHandles(
  handles: unknown,
  resize: unknown,
  controls: unknown,
  report: ReturnType<typeof createEffectV1Diagnostics>,
): void {
  if (handles === undefined) return;
  if (!Array.isArray(handles) || handles.length < 1 || handles.length > 8) {
    report.error(
      "OBJECT_HANDLES",
      "$.objectLayout.handles",
      "Expected one to eight object handles.",
    );
    return;
  }
  if (resize !== "scale")
    report.error(
      "OBJECT_HANDLE_RESIZE",
      "$.objectLayout.resize",
      "External handles require scale layout.",
    );
  const ids = new Set<string>();
  handles.forEach((handle, index) => {
    const path = `$.objectLayout.handles[${index}]`;
    if (!isRecord(handle)) {
      report.error("OBJECT_HANDLE_TYPE", path, "Expected a handle object.");
      return;
    }
    rejectUnknownKeys(
      handle,
      new Set(["id", "label", "xControl", "yControl", "padding"]),
      path,
      report,
    );
    if (requireIdentifier(handle.id, `${path}.id`, report)) {
      if (ids.has(handle.id))
        report.error(
          "OBJECT_HANDLE_DUPLICATE",
          `${path}.id`,
          "Handle identifiers must be unique.",
        );
      ids.add(handle.id);
    }
    validateLocaleText(handle.label, `${path}.label`, true, report);
    if (
      typeof handle.padding !== "number" ||
      !Number.isFinite(handle.padding) ||
      handle.padding < 0 ||
      handle.padding > 256
    ) {
      report.error(
        "OBJECT_HANDLE_PADDING",
        `${path}.padding`,
        "Expected padding between 0 and 256.",
      );
    }
    for (const key of ["xControl", "yControl"]) {
      requireIdentifier(handle[key], `${path}.${key}`, report);
      const control = Array.isArray(controls)
        ? controls.find((c) => isRecord(c) && c.id === handle[key])
        : undefined;
      if (
        !isRecord(control) ||
        control.kind !== "number" ||
        typeof control.min !== "number" ||
        typeof control.max !== "number" ||
        !Number.isFinite(control.min) ||
        !Number.isFinite(control.max) ||
        control.min < -EFFECT_V1_HANDLE_MAX_COORDINATE ||
        control.max > EFFECT_V1_HANDLE_MAX_COORDINATE
      ) {
        report.error(
          "OBJECT_HANDLE_CONTROL",
          `${path}.${key}`,
          "Expected a declared number control bounded within -1000000..1000000 logical units.",
        );
      }
    }
    if (handle.xControl === handle.yControl)
      report.error(
        "OBJECT_HANDLE_AXES",
        path,
        "Each axis needs a separate control.",
      );
  });
}
