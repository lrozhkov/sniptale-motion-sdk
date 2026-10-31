import { bindViewerAction } from "../../app/bind-action.js";
import type { MotionPathTrack } from "../../../../shared/timeline/motion-path.js";
import type { ViewerAppContext } from "../../app/context.js";

function getTimelineTrackDisplayLabel(
  ctx: ViewerAppContext,
  track: MotionPathTrack | null | undefined,
): string {
  if (typeof track?.label === "string" && track.label.trim()) {
    return track.label;
  }
  const property =
    typeof track?.property === "string" && track.property.trim()
      ? track.property
      : null;
  if (!property) {
    return String(track?.id ?? "");
  }
  const fallback = ctx.toTitleLabel(property);
  const contentLabel = ctx.deps.t(
    `viewer.inspector.layerFields.${property}`,
    fallback,
  );
  return ctx.deps.t(`viewer.inspector.fields.${property}`, contentLabel);
}

export function createTimelineLabelActions(getContext: () => ViewerAppContext) {
  return {
    getTimelineTrackDisplayLabel: bindViewerAction(
      getTimelineTrackDisplayLabel,
      getContext,
    ),
  };
}
