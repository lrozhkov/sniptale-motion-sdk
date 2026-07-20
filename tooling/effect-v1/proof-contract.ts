export function createEffectV1RuntimeContractProof(
  document: any,
  coverage: any,
  issues: any[] = [],
) {
  const expected = {
    controls: collectIds(document?.controls),
    phases: collectIds(document?.timeline?.phases),
    tracks: collectIds(document?.timeline?.tracks),
  };
  const actual = {
    controls: collectStrings(coverage?.controls),
    phases: collectStrings(coverage?.phases),
    tracks: collectStrings(coverage?.tracks),
  };
  const missing = {
    controls: difference(expected.controls, actual.controls),
    phases: difference(expected.phases, actual.phases),
    tracks: difference(expected.tracks, actual.tracks),
  };
  const contractIssues = (Array.isArray(issues) ? issues : [])
    .filter((issue) => issue?.category === "Contract")
    .map((issue) => String(issue.message ?? issue.code ?? "Contract issue"));
  return {
    actual,
    contractIssues,
    expected,
    missing,
    ok:
      contractIssues.length === 0 &&
      missing.controls.length === 0 &&
      missing.phases.length === 0 &&
      missing.tracks.length === 0,
  };
}

function collectIds(values: unknown): string[] {
  return Array.isArray(values)
    ? values
        .map((value) => value?.id)
        .filter((value): value is string => typeof value === "string")
        .sort()
    : [];
}

function collectStrings(values: unknown): string[] {
  return Array.isArray(values)
    ? values
        .filter((value): value is string => typeof value === "string")
        .sort()
    : [];
}

function difference(expected: string[], actual: string[]): string[] {
  const available = new Set(actual);
  return expected.filter((value) => !available.has(value));
}
