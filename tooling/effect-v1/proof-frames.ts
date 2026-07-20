export function createEffectV1ProofTimes(duration: number): number[] {
  const safeDuration = Math.max(0.001, Number(duration) || 0.001);
  const edgeInset = Math.min(0.35, safeDuration * 0.18);
  return Array.from(
    new Set(
      [
        0,
        edgeInset,
        safeDuration / 2,
        Math.max(0, safeDuration - edgeInset),
        safeDuration,
      ].map((time) => Number(time.toFixed(6))),
    ),
  );
}

export function assessEffectV1FrameProof(frames: any[]) {
  const values = Array.isArray(frames) ? frames : [];
  const visible = values.filter(
    (frame) => Number(frame?.occupied) >= 24 && Number(frame?.lit) >= 24,
  );
  const hashes = new Set(
    values
      .map((frame) => frame?.hash)
      .filter((hash): hash is string => typeof hash === "string"),
  );
  const midpoint = values[Math.floor(values.length / 2)] ?? null;
  const midpointVisible = Boolean(
    midpoint && Number(midpoint.occupied) >= 24 && Number(midpoint.lit) >= 24,
  );
  return {
    animated: hashes.size > 1,
    midpointVisible,
    ok: midpointVisible && hashes.size > 1 && visible.length > 0,
    visibleSamples: visible.length,
  };
}
