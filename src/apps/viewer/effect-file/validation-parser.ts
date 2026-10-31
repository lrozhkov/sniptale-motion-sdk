export function parseSniptaleEffectFilePayload(
  source: string,
  errors: string[] = [],
): unknown {
  try {
    return JSON.parse(source);
  } catch (error) {
    errors.push(
      `Effect document is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}
