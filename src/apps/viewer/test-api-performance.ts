import type { ViewerAppContext } from "./app/context.js";

export function installTimelineStressModelForTest(
  ctx: ViewerAppContext,
  layerCount = 120,
) {
  const template = ctx.state.currentTemplate;
  if (!template) {
    return null;
  }
  const count = Math.max(1, Math.floor(Number(layerCount) || 120));
  const duration = ctx.getEffectiveDuration(template);
  const scene = {
    duration,
    id: "timeline-stress-scene",
    label: "Timeline stress",
    locked: false,
    start: 0,
  };
  const layers = Array.from({ length: count }, (_, index) => ({
    editor: {
      canvas: "bounds",
      keyframeProperties: ["opacity"],
      properties: ["opacity"],
    },
    height: 8,
    id: `timeline-stress-layer-${index}`,
    locked: false,
    name: `Timeline stress layer ${index}`,
    opacity: 1,
    parentId: null,
    type: "rect",
    visible: true,
    width: 8,
    x: 0,
    y: 0,
  }));
  const clips = layers.map((layer) => ({
    duration,
    layerId: layer.id,
    locked: false,
    offset: 0,
    sceneId: scene.id,
    start: 0,
  }));
  const timeline = {
    duration,
    phases: [],
    tracks: layers.map((layer, index) => ({
      id: `${layer.id}.opacity`,
      keyframes: [
        { id: `${layer.id}-a`, time: 0, value: index % 2 },
        { id: `${layer.id}-b`, time: duration, value: (index + 1) % 2 },
      ],
      layerId: layer.id,
      property: "opacity",
    })),
  };
  ctx.setEditorOverride({ clips, layers, scenes: [scene] });
  ctx.state.timelineOverrides.set(template.id, timeline);
  ctx.state.expandedSceneIds = new Set([scene.id]);
  ctx.state.expandedTimelineRowIds =
    ctx.createExpandedTimelineRowIdSet(template);
  ctx.renderTimelineEditor(template);
  return {
    rendered: ctx.state.timelineRenderedRowCount,
    total: ctx.state.timelineTotalRowCount,
  };
}
