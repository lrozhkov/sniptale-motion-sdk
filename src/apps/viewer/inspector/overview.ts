import type { ViewerAppContext } from "../app/context.js";
import { getKeyframeEasingLabel } from "./keyframe-labels.js";

function renderInspector(ctx: ViewerAppContext) {
  ctx.refs.inspectorPanel.innerHTML = "";
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!template || !effectiveTemplate) {
    if (ctx.refs.inspectorContext) {
      ctx.refs.inspectorContext.hidden = true;
    }
    ctx.refs.inspectorPanel.textContent = ctx.deps.t(
      "viewer.selection.none",
      "No selection",
    );
    return;
  }
  ctx.reconcileTimelineSelection(effectiveTemplate);
  const item = ctx.state.selectedItem ?? { type: "effect" };
  ctx.syncInspectorTabs(item);
  ctx.renderInspectorContext(item, template);
  ctx.prepareInspectorSections();
  const t = (key, fallback) => ctx.deps.t(key, fallback);
  const valid = t("viewer.inspector.values.valid", "Valid");
  const outOfRange = t("viewer.inspector.values.outOfRange", "Out of range");
  if (item.type === "layer") {
    ctx.appendLayerSelectionOverview(item, effectiveTemplate);
    return;
  }
  if (item.type === "clip") {
    ctx.appendClipSelectionOverview(item, effectiveTemplate);
    return;
  }
  if (item.type === "scene") {
    const scene = ctx
      .normalizeScenes(
        effectiveTemplate.scenes ?? [],
        effectiveTemplate.duration,
      )
      .find((entry) => entry.id === item.sceneId);
    ctx.setInspectorAppendSection("summary");
    ctx.appendInspectorRows(t("viewer.inspector.context.scene", "Scene"), [
      [t("viewer.inspector.fields.name", "Name"), scene?.label ?? item.sceneId],
      [
        t("viewer.inspector.fields.start", "Start"),
        ctx.formatSeconds(scene?.start ?? 0),
      ],
      [
        t("viewer.inspector.fields.duration", "Duration"),
        ctx.formatSeconds(scene?.duration ?? 0),
      ],
      [
        t("viewer.inspector.fields.state", "State"),
        scene &&
        ctx.isRangeInvalid(
          scene.start,
          scene.duration,
          effectiveTemplate.duration,
        )
          ? outOfRange
          : valid,
      ],
    ]);
    if (scene) {
      ctx.setInspectorAppendSection("timing");
      ctx.appendSceneTimingInspector(scene, effectiveTemplate.duration);
      ctx.setInspectorAppendSection("ownership");
      ctx.appendTimingOwnershipInspector(
        ctx.getSceneOwnershipSummary(effectiveTemplate, scene),
      );
    }
    return;
  }
  if (item.type === "phase") {
    const phase = effectiveTemplate.timeline.phases.find(
      (entry) => entry.id === item.phaseId,
    );
    ctx.setInspectorAppendSection("summary");
    ctx.appendInspectorRows(t("viewer.inspector.context.phase", "Phase"), [
      [t("viewer.inspector.fields.name", "Name"), phase?.label ?? item.phaseId],
      [
        t("viewer.inspector.fields.start", "Start"),
        ctx.formatSeconds(phase?.start ?? 0),
      ],
      [
        t("viewer.inspector.fields.duration", "Duration"),
        ctx.formatSeconds(phase?.duration ?? 0),
      ],
      [
        t("viewer.inspector.fields.state", "State"),
        phase &&
        ctx.isRangeInvalid(
          phase.start,
          phase.duration,
          effectiveTemplate.duration,
        )
          ? outOfRange
          : valid,
      ],
    ]);
    if (phase) {
      ctx.setInspectorAppendSection("timing");
      ctx.appendPhaseTimingInspector(phase, effectiveTemplate.duration);
      ctx.setInspectorAppendSection("ownership");
      ctx.appendPhaseOwnershipEditor(phase, effectiveTemplate);
      ctx.appendTimingOwnershipInspector(
        ctx.getPhaseOwnershipSummary(effectiveTemplate, phase),
      );
    }
    return;
  }
  if (item.type === "track") {
    const track = effectiveTemplate.timeline.tracks.find(
      (entry) => entry.id === item.trackId,
    );
    const layerId = ctx.getTrackLayerId(track);
    const layer = layerId
      ? effectiveTemplate.layers.find((entry) => entry.id === layerId)
      : null;
    ctx.setInspectorAppendSection("summary");
    ctx.appendInspectorRows(
      t("viewer.inspector.context.track", "Property track"),
      [
        [
          t("viewer.inspector.fields.name", "Name"),
          track?.label ?? item.trackId,
        ],
        [
          t("viewer.inspector.fields.layer", "Layer"),
          layer?.name ?? layerId ?? t("viewer.inspector.values.none", "None"),
        ],
        [
          t("viewer.inspector.fields.property", "Property"),
          track?.property ??
            ctx.inferTrackProperty(track) ??
            t("viewer.inspector.values.unknown", "Unknown"),
        ],
        [
          t("viewer.inspector.fields.keys", "Keyframes"),
          String(track?.keyframes?.length ?? 0),
        ],
        [
          t("viewer.inspector.fields.phase", "Phase"),
          track?.phaseId ?? t("viewer.inspector.values.none", "None"),
        ],
        [
          t("viewer.inspector.fields.scene", "Scene"),
          track?.sceneId ?? t("viewer.inspector.values.none", "None"),
        ],
      ],
    );
    if (track) {
      ctx.setInspectorAppendSection("timing");
      ctx.appendTrackKeyframeActions(track);
      ctx.setInspectorAppendSection("ownership");
      ctx.appendTrackOwnershipEditor(track, effectiveTemplate);
      ctx.appendTimingOwnershipInspector(
        ctx.getTrackOwnershipSummary(effectiveTemplate, track),
      );
    }
    return;
  }
  if (item.type === "keyframe") {
    if (ctx.appendMotionPathPointInspector(effectiveTemplate)) {
      return;
    }
    if (ctx.appendKeyframeSelectionInspector(effectiveTemplate)) {
      return;
    }
    const track = effectiveTemplate.timeline.tracks.find(
      (entry) => entry.id === item.trackId,
    );
    const keyframe = track?.keyframes.find(
      (entry) => entry.id === item.keyframeId,
    );
    ctx.setInspectorAppendSection("summary");
    ctx.appendInspectorRows(
      t("viewer.inspector.context.keyframe", "Keyframe"),
      [
        [
          t("viewer.inspector.fields.track", "Track"),
          track?.label ?? item.trackId,
        ],
        [
          t("viewer.inspector.fields.time", "Time"),
          ctx.formatSeconds(keyframe?.time ?? 0),
        ],
        [
          t("viewer.inspector.fields.value", "Value"),
          typeof keyframe?.value === "number"
            ? String(keyframe.value.toFixed(3))
            : JSON.stringify(keyframe?.value),
        ],
        [
          t("viewer.inspector.fields.easing", "Easing"),
          getKeyframeEasingLabel(ctx, keyframe?.easing),
        ],
        [
          t("viewer.inspector.fields.state", "State"),
          keyframe && keyframe.time > effectiveTemplate.duration
            ? outOfRange
            : valid,
        ],
      ],
    );
    if (track && keyframe) {
      ctx.setInspectorAppendSection("timing");
      ctx.appendKeyframeCurveInspector(
        track,
        keyframe,
        effectiveTemplate.duration,
      );
      ctx.setInspectorAppendSection("ownership");
      ctx.appendKeyframeOwnershipEditor(track, keyframe, effectiveTemplate);
      ctx.appendTimingOwnershipInspector(
        ctx.getKeyframeOwnershipSummary(effectiveTemplate, track, keyframe),
      );
    }
    return;
  }
  if (item.type === "asset") {
    const asset = ctx.state.assets.get(item.assetId);
    const usageLayers = ctx.deps.getAssetUsageLayers(
      effectiveTemplate,
      item.assetId,
    );
    ctx.setInspectorAppendSection("summary");
    ctx.appendInspectorRows(t("viewer.inspector.context.asset", "Asset"), [
      ["ID", item.assetId],
      [
        t("viewer.inspector.fields.path", "Path"),
        asset?.path ?? t("viewer.inspector.values.missing", "Missing"),
      ],
      [
        "MIME",
        asset?.mimeType ??
          asset?.kind ??
          t("viewer.inspector.values.missing", "Missing"),
      ],
      [
        t("viewer.inspector.fields.size", "Size"),
        asset && asset.width && asset.height
          ? `${Math.round(asset.width)} x ${Math.round(asset.height)}`
          : t("viewer.inspector.values.unknown", "Unknown"),
      ],
      [
        t("viewer.inspector.fields.usedBy", "Used by"),
        t("viewer.inspector.values.layerCount", "{count} layers").replace(
          "{count}",
          String(usageLayers.length),
        ),
      ],
      [
        t("viewer.inspector.fields.state", "State"),
        asset ? valid : t("viewer.inspector.values.missing", "Missing"),
      ],
    ]);
    ctx.setInspectorAppendSection("ownership");
    ctx.appendAssetUsageInspector(usageLayers);
    return;
  }
  ctx.renderEffectOverview(template, effectiveTemplate);
}

export function installInspectorOverviewOwner(ctx: ViewerAppContext): void {
  ctx.renderInspector = renderInspector.bind(undefined, ctx);
}
