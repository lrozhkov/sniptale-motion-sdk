export function calculateTrackDragBounds({
  duration,
  keyframes,
  phaseById,
  scene,
  track,
}) {
  const minTime = Math.min(...keyframes.map((keyframe) => keyframe.time));
  const maxTime = Math.max(...keyframes.map((keyframe) => keyframe.time));
  let start = 0;
  let end = Math.max(0.001, Number(duration) || 0.001);
  if (scene) {
    start = Math.max(start, Number(scene.start) || 0);
    end = Math.min(
      end,
      (Number(scene.start) || 0) + (Number(scene.duration) || 0),
    );
  }
  const phaseIds = new Set(
    keyframes
      .map((keyframe) => keyframe.phaseId ?? track.phaseId)
      .filter((phaseId) => typeof phaseId === "string" && phaseId),
  );
  if (phaseIds.size === 1) {
    const phase = phaseById.get(phaseIds.values().next().value);
    if (phase) {
      start = Math.max(start, Number(phase.start) || 0);
      end = Math.min(
        end,
        (Number(phase.start) || 0) + (Number(phase.duration) || 0),
      );
    }
  }
  const minDelta = start - minTime;
  return {
    maxDelta: Math.max(minDelta, end - maxTime),
    minDelta,
  };
}
