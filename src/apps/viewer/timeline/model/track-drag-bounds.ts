import type {
  EffectScene,
  TimelineKeyframe,
  TimelinePhase,
} from "../../../../sdk/types.js";
import type { MotionPathTrack } from "../../../../shared/timeline/motion-path.js";

type TrackDragBoundsOptions = {
  duration: number;
  keyframes: readonly Pick<
    TimelineKeyframe<unknown>,
    "id" | "time" | "phaseId"
  >[];
  phaseById: ReadonlyMap<string, Pick<TimelinePhase, "start" | "duration">>;
  scene: Pick<EffectScene, "id" | "start" | "duration"> | null | undefined;
  track: Pick<MotionPathTrack, "id" | "phaseId">;
};

export function calculateTrackDragBounds({
  duration,
  keyframes,
  phaseById,
  scene,
  track,
}: TrackDragBoundsOptions): { minDelta: number; maxDelta: number } {
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
      .filter(
        (phaseId): phaseId is string =>
          typeof phaseId === "string" && phaseId.length > 0,
      ),
  );
  if (phaseIds.size === 1) {
    const phaseId = phaseIds.values().next().value;
    const phase = phaseId === undefined ? undefined : phaseById.get(phaseId);
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
