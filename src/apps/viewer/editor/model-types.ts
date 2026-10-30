import type { TimelinePhase, TimelineMotionPath } from "../../../sdk/types.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";

export type EditorTimeline = {
  duration: number;
  motionPaths?: TimelineMotionPath[];
  phases: TimelinePhase[];
  tracks: MotionPathTrack[];
};
