export type TimelinePhaseBounds = {
  auto: boolean;
  duration: number;
  end: number;
  start: number;
};

export function getPhaseRowTimingBounds(phaseRow: any): TimelinePhaseBounds {
  const phaseStart = Number(phaseRow?.phase?.start);
  const phaseDuration = Number(phaseRow?.phase?.duration);
  if (
    Number.isFinite(phaseStart) &&
    Number.isFinite(phaseDuration) &&
    phaseDuration > 0
  ) {
    return {
      auto: false,
      duration: phaseDuration,
      end: phaseStart + phaseDuration,
      start: phaseStart,
    };
  }
  const times = [];
  for (const trackRow of phaseRow?.tracks ?? []) {
    for (const keyframe of trackRow.keyframes ?? []) {
      const time = Number(keyframe.time);
      if (Number.isFinite(time)) {
        times.push(time);
      }
    }
  }
  if (times.length > 0) {
    const start = Math.min(...times);
    const end = Math.max(...times);
    return {
      auto: true,
      duration: Math.max(0.05, end - start),
      end,
      start,
    };
  }
  const start = Number.isFinite(phaseStart) ? phaseStart : 0;
  const duration = 0.05;
  return {
    auto: false,
    duration,
    end: start + duration,
    start,
  };
}
