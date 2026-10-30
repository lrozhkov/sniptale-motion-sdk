import type { TimelinePhase } from "../../../sdk/types.js";
import type {
  MotionPathTrack,
  TimelineMotionPath,
} from "../../../shared/timeline/motion-path.js";

export type EditorTimeline = {
  duration: number;
  motionPaths?: TimelineMotionPath[];
  phases: TimelinePhase[];
  tracks: MotionPathTrack[];
};
