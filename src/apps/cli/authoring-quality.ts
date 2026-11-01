import type {
  EffectV1Diagnostic,
  EffectV1Document,
} from "../../sdk/effect-v1/types.js";

// Deliberately bounded to explicit suffixes. Do not guess a numeric control's dimension from its ID.
const UNIT_SUFFIX =
  /(?:\s|[([])(?:px|%|ms|hz|гц|deg|°|×|шт\.?)(?:[)\]])?$|[([](?:s|с|мс|ratio|count|percent)[)\]]$/iu;

/** Opt-in authoring checks; ordinary validation retains the legacy document contract. */
export function inspectControlAuthoring(
  document: EffectV1Document,
): EffectV1Diagnostic[] {
  const diagnostics: EffectV1Diagnostic[] = [];
  for (const [index, control] of document.controls.entries()) {
    if (control.kind !== "number" || !control.label) continue;
    for (const [locale, text] of Object.entries(control.label)) {
      if (typeof text !== "string" || !UNIT_SUFFIX.test(text.trim())) continue;
      diagnostics.push({
        code: control.unit
          ? "AUTHORING_CONTROL_LABEL_UNIT"
          : "AUTHORING_CONTROL_UNIT",
        path: `$.controls[${index}].label.${locale}`,
        severity: "error",
        message: "Numeric control labels must keep units in control.unit.",
        suggestion:
          "Declare the matching unit without changing the raw numeric values, then remove the unit suffix from the label.",
      });
    }
  }
  return diagnostics;
}
