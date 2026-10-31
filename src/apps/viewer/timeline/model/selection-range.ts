import { bindViewerAction } from "../../app/bind-action.js";
import type { EditorTemplate } from "../../templates/model.js";
import type { MotionPathTrack } from "../../../../shared/timeline/motion-path.js";
import type { TimelineKeyframe } from "../../../../sdk/types.js";
import type { SelectedTimelineRange } from "./ownership-model.js";
import type { ViewerAppContext } from "../../app/context.js";

function createSelectedKeyframeSegmentRange(
  ctx: ViewerAppContext,
  track: MotionPathTrack,
  visibleKeyframes: TimelineKeyframe<unknown>[],
  duration: number,
): HTMLDivElement | null {
  const selected = ctx.getPrimaryKeyframeSelection();
  if (
    !selected ||
    selected.trackId !== track.id ||
    !visibleKeyframes.some((keyframe) => keyframe.id === selected.keyframeId)
  ) {
    return null;
  }
  const keyframes = [...(track.keyframes ?? [])].sort(
    (a, b) => a.time - b.time,
  );
  const index = keyframes.findIndex(
    (keyframe) => keyframe.id === selected.keyframeId,
  );
  const from = index >= 0 ? keyframes[index] : null;
  const to =
    index >= 0 && index < keyframes.length - 1 ? keyframes[index + 1] : null;
  if (!from || !to || to.time <= from.time) {
    return null;
  }
  const range = document.createElement("div");
  range.className = "keyframe-segment-range";
  range.dataset.trackId = track.id;
  range.dataset.fromKeyframeId = from.id;
  range.dataset.toKeyframeId = to.id;
  range.title = ctx.deps
    .t("viewer.timeline.curveSegmentRange", "Curve segment {start} → {end}")
    .replace("{start}", ctx.formatSeconds(from.time))
    .replace("{end}", ctx.formatSeconds(to.time));
  range.style.left = `${ctx.timelinePercent(from.time, duration)}%`;
  range.style.width = `${Math.max(0.2, ctx.timelinePercent(to.time, duration) - ctx.timelinePercent(from.time, duration))}%`;
  range.addEventListener("pointerdown", (event) =>
    ctx.beginKeyframeSegmentDrag(event, track.id, from.id, to.id, "move"),
  );
  const startEdge = document.createElement("span");
  startEdge.className = "keyframe-segment-edge start";
  startEdge.addEventListener("pointerdown", (event) =>
    ctx.beginKeyframeSegmentDrag(event, track.id, from.id, to.id, "start"),
  );
  const endEdge = document.createElement("span");
  endEdge.className = "keyframe-segment-edge end";
  endEdge.addEventListener("pointerdown", (event) =>
    ctx.beginKeyframeSegmentDrag(event, track.id, from.id, to.id, "end"),
  );
  range.append(startEdge, endEdge);
  return range;
}
function getSelectedTimelineRange(
  ctx: ViewerAppContext,
  template: EditorTemplate,
): SelectedTimelineRange | null {
  const item = ctx.state.selectedItem ?? { type: "effect" };
  const timeline = template.timeline ?? {
    duration: template.duration,
    phases: [],
    tracks: [],
  };
  if (item.type === "scene") {
    const scene = ctx
      .normalizeScenes(template.scenes ?? [], template.duration)
      .find((entry) => entry.id === item.sceneId);
    return scene
      ? {
          end: scene.start + scene.duration,
          sceneId: scene.id,
          selector: `.scene-block[data-scene-id="${ctx.cssEscape(scene.id)}"]`,
          start: scene.start,
        }
      : null;
  }
  if (item.type === "clip" || item.type === "layer") {
    const clip = (template.clips ?? []).find(
      (entry) => entry.layerId === item.layerId,
    );
    if (item.type === "layer" && !clip) {
      const sceneId = ctx.normalizeScenes(
        template.scenes ?? [],
        template.duration,
      )[0]?.id;
      return {
        end: template.duration,
        sceneId: sceneId ?? null,
        selector: `.timeline-lane.layer-lane[data-layer-id="${ctx.cssEscape(item.layerId)}"]`,
        start: 0,
      };
    }
    const scenes = ctx.normalizeScenes(
      template.scenes ?? [],
      template.duration,
    );
    const sceneId =
      clip && ctx.isGlobalTimelineClip(clip, scenes)
        ? null
        : (clip?.sceneId ??
          ctx.findSceneIdAtTime(ctx.state.currentTemplate, clip?.start ?? 0));
    return clip
      ? {
          end: clip.start + clip.duration,
          sceneId,
          selector:
            item.type === "layer"
              ? `.timeline-lane.layer-lane[data-layer-id="${ctx.cssEscape(clip.layerId)}"]`
              : `.clip-block[data-layer-id="${ctx.cssEscape(clip.layerId)}"]`,
          start: clip.start,
        }
      : null;
  }
  if (item.type === "phase") {
    const phase = (timeline.phases ?? []).find(
      (entry) => entry.id === item.phaseId,
    );
    const sceneId =
      phase?.sceneId ??
      ctx.findSceneIdAtTime(ctx.state.currentTemplate, phase?.start ?? 0);
    return phase
      ? {
          end: phase.start + phase.duration,
          sceneId,
          selector: `.phase-block[data-phase-id="${ctx.cssEscape(phase.id)}"]`,
          start: phase.start,
        }
      : null;
  }
  if (item.type === "keyframe") {
    const refsToFrame = ctx.getSelectedKeyframeRefs();
    const keyframes = refsToFrame
      .map((ref) => {
        const track = (timeline.tracks ?? []).find(
          (entry) => entry.id === ref.trackId,
        );
        const keyframe = track?.keyframes.find(
          (entry) => entry.id === ref.keyframeId,
        );
        return track && keyframe ? { keyframe, track } : null;
      })
      .filter((entry) => entry !== null);
    if (keyframes.length === 0) {
      return null;
    }
    const start = Math.min(...keyframes.map((entry) => entry.keyframe.time));
    const end = Math.max(...keyframes.map((entry) => entry.keyframe.time));
    const primary = keyframes.at(-1);
    if (!primary) return null;
    return {
      end,
      sceneId:
        ctx.getKeyframeOwnershipSceneId(
          timeline,
          primary.track,
          primary.keyframe,
        ) ??
        ctx.findSceneIdAtTime(ctx.state.currentTemplate, primary.keyframe.time),
      selector: `.keyframe-point[data-track-id="${ctx.cssEscape(primary.track.id)}"][data-keyframe-id="${ctx.cssEscape(primary.keyframe.id)}"]`,
      start,
    };
  }
  if (item.type === "track") {
    const track = (timeline.tracks ?? []).find(
      (entry) => entry.id === item.trackId,
    );
    const times = (track?.keyframes ?? [])
      .map((keyframe) => Number(keyframe.time))
      .filter(Number.isFinite);
    if (!track || times.length === 0) {
      return null;
    }
    const start = Math.min(...times);
    const end = Math.max(...times);
    return {
      end,
      sceneId:
        track.sceneId ??
        ctx.findSceneIdAtTime(ctx.state.currentTemplate, start),
      selector: `.timeline-lane[data-track-id="${ctx.cssEscape(track.id)}"]`,
      start,
    };
  }
  return { end: template.duration, sceneId: null, selector: null, start: 0 };
}
export function createTimelineSelectionRangeActions(
  getContext: () => ViewerAppContext,
) {
  return {
    createSelectedKeyframeSegmentRange: bindViewerAction(
      createSelectedKeyframeSegmentRange,
      getContext,
    ),
    getSelectedTimelineRange: bindViewerAction(
      getSelectedTimelineRange,
      getContext,
    ),
  };
}
