export function createEffectV1ControlProofCases(controls) {
  if (!Array.isArray(controls)) return [];
  return controls.map((control) => ({
    defaultValue: control.defaultValue,
    id: control.id,
    kind: control.kind,
    value: resolveAlternateControlValue(control),
  }));
}

export function didEffectV1ControlChange(baselineFrames, variantFrames) {
  return variantFrames.some(
    (frame, index) => frame.hash !== baselineFrames[index]?.hash,
  );
}

function resolveAlternateControlValue(control) {
  if (control.kind === "text") {
    return `${control.defaultValue || "Sniptale"} · proof`;
  }
  if (control.kind === "color") {
    return String(control.defaultValue).toLowerCase() === "#ff2d55"
      ? "#00d4ff"
      : "#ff2d55";
  }
  if (control.kind === "number") {
    const current = Number(control.defaultValue);
    const candidates = [
      Number(control.max),
      Number(control.min),
      current + Math.max(Math.abs(Number(control.step)) || 1, 1),
      current - Math.max(Math.abs(Number(control.step)) || 1, 1),
    ];
    const alternate = candidates.find(
      (candidate) =>
        Number.isFinite(candidate) &&
        candidate !== current &&
        (!Number.isFinite(control.min) || candidate >= Number(control.min)) &&
        (!Number.isFinite(control.max) || candidate <= Number(control.max)),
    );
    if (alternate !== undefined) return alternate;
  }
  throw new Error(
    `Control "${String(control.id)}" has no alternate value for runtime proof.`,
  );
}
