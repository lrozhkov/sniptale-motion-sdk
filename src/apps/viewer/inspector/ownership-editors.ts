import type { ViewerAppContext } from "../app/context.js";

function appendTimingOwnershipInspector(ctx: ViewerAppContext, summary) {
  if (!summary) {
    return;
  }
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = ctx.deps.t(
    "viewer.inspector.timingOwnership",
    "Timing ownership",
  );
  ctx.appendInspectorNode(heading);
  const box = document.createElement("div");
  box.className = "ownership-summary";
  for (const [label, value] of summary.rows) {
    const row = document.createElement("div");
    row.className = "ownership-summary-row";
    const name = document.createElement("span");
    name.textContent = label;
    const output = document.createElement("strong");
    output.textContent = value;
    row.append(name, output);
    box.append(row);
  }
  const note = document.createElement("p");
  note.textContent = summary.note;
  box.append(note);
  ctx.appendInspectorNode(box);
}

function appendClipOwnershipEditor(ctx: ViewerAppContext, clip, template) {
  ctx.appendOwnershipHeading();
  ctx.appendInspectorSelectRow({
    dataset: { layerId: clip.layerId, ownershipProperty: "sceneId" },
    label: ctx.deps.t("viewer.inspector.fields.scene", "Scene"),
    onChange: (value) => ctx.updateClipOwnership(clip.layerId, value || null),
    options: ctx.createSceneOptions(
      template,
      ctx.deps.t("viewer.inspector.values.autoTime", "Auto / time window"),
    ),
    value: clip.sceneId ?? "",
  });
}

function appendPhaseOwnershipEditor(ctx: ViewerAppContext, phase, template) {
  ctx.appendOwnershipHeading();
  ctx.appendInspectorSelectRow({
    dataset: { phaseId: phase.id, ownershipProperty: "sceneId" },
    label: ctx.deps.t("viewer.inspector.fields.scene", "Scene"),
    onChange: (value) => ctx.updatePhaseOwnership(phase.id, value || null),
    options: ctx.createSceneOptions(
      template,
      ctx.deps.t("viewer.inspector.values.autoTime", "Auto / time window"),
    ),
    value: phase.sceneId ?? "",
  });
}

function appendTrackOwnershipEditor(ctx: ViewerAppContext, track, template) {
  ctx.appendOwnershipHeading();
  ctx.appendInspectorSelectRow({
    dataset: { ownershipProperty: "phaseId", trackId: track.id },
    label: ctx.deps.t("viewer.inspector.fields.phase", "Phase"),
    onChange: (value) =>
      ctx.updateTrackOwnership(track.id, { phaseId: value || null }),
    options: ctx.createPhaseOptions(
      template,
      ctx.deps.t("viewer.inspector.values.autoNone", "Auto / none"),
    ),
    value: track.phaseId ?? "",
  });
  ctx.appendInspectorSelectRow({
    dataset: { ownershipProperty: "sceneId", trackId: track.id },
    label: ctx.deps.t("viewer.inspector.fields.scene", "Scene"),
    onChange: (value) =>
      ctx.updateTrackOwnership(track.id, { sceneId: value || null }),
    options: ctx.createSceneOptions(
      template,
      ctx.deps.t("viewer.inspector.values.autoTime", "Auto / time window"),
    ),
    value: track.sceneId ?? "",
  });
}

function appendTrackKeyframeActions(ctx: ViewerAppContext, track) {
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = ctx.deps.t(
    "viewer.inspector.trackActions",
    "Track actions",
  );
  ctx.appendInspectorNode(heading);
  const row = document.createElement("div");
  row.className = "inspector-action-row";
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.inspectorAction = "add-track-keyframe";
  button.dataset.trackId = track.id;
  button.textContent = ctx.deps.t(
    "viewer.timeline.addKeyAtPlayhead",
    "Add key at playhead",
  );
  button.title = ctx.deps.t(
    "viewer.timeline.addKeyAtPlayheadTitle",
    "Create or update a keyframe on this track at the current playhead time. Shortcut: K",
  );
  button.addEventListener("click", () => ctx.addKeyframeAtPlayhead(track.id));
  row.append(button);
  ctx.appendInspectorNode(row);
}

function appendKeyframeOwnershipEditor(
  ctx: ViewerAppContext,
  track,
  keyframe,
  template,
) {
  ctx.appendOwnershipHeading();
  ctx.appendInspectorSelectRow({
    dataset: {
      keyframeId: keyframe.id,
      ownershipProperty: "phaseId",
      trackId: track.id,
    },
    label: ctx.deps.t("viewer.inspector.fields.phase", "Phase"),
    onChange: (value) =>
      ctx.updateSelectedKeyframe(
        { phaseId: value || null },
        track.id,
        keyframe.id,
      ),
    options: ctx.createPhaseOptions(
      template,
      track.phaseId
        ? ctx.deps
            .t("viewer.inspector.values.inherit", "Inherit {value}")
            .replace("{value}", track.phaseId)
        : ctx.deps.t("viewer.inspector.values.autoNone", "Auto / none"),
    ),
    value: keyframe.phaseId ?? "",
  });
  ctx.appendInspectorSelectRow({
    dataset: {
      keyframeId: keyframe.id,
      ownershipProperty: "sceneId",
      trackId: track.id,
    },
    label: ctx.deps.t("viewer.inspector.fields.scene", "Scene"),
    onChange: (value) =>
      ctx.updateSelectedKeyframe(
        { sceneId: value || null },
        track.id,
        keyframe.id,
      ),
    options: ctx.createSceneOptions(
      template,
      track.sceneId
        ? ctx.deps
            .t("viewer.inspector.values.inherit", "Inherit {value}")
            .replace("{value}", track.sceneId)
        : ctx.deps.t("viewer.inspector.values.autoTime", "Auto / time window"),
    ),
    value: keyframe.sceneId ?? "",
  });
}

function appendOwnershipHeading(ctx: ViewerAppContext) {
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = ctx.deps.t("viewer.inspector.ownership", "Ownership");
  ctx.appendInspectorNode(heading);
}

function createSceneOptions(ctx: ViewerAppContext, template, emptyLabel) {
  return createOwnershipOptions(
    ctx.normalizeScenes(template.scenes ?? [], template.duration),
    emptyLabel,
  );
}

function createPhaseOptions(ctx: ViewerAppContext, template, emptyLabel) {
  return createOwnershipOptions(template.timeline?.phases ?? [], emptyLabel);
}

function createOwnershipOptions(items, emptyLabel) {
  const labels = items.map((item) => String(item.label || item.id));
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [
    { label: emptyLabel, title: emptyLabel, value: "" },
    ...items.map((item, index) => {
      const label = labels[index];
      const title = label === item.id ? label : `${label} (${item.id})`;
      return {
        label: counts.get(label)! > 1 ? title : label,
        title,
        value: item.id,
      };
    }),
  ];
}

function appendInspectorSelectRow(
  ctx: ViewerAppContext,
  { dataset = {}, label, onChange, options, value },
) {
  const row = document.createElement("label");
  row.className = "inspector-row inspector-edit-row inspector-select-row";
  const name = document.createElement("span");
  name.textContent = label;
  const select = document.createElement("select");
  select.setAttribute("aria-label", label);
  Object.entries(dataset).forEach(([key, entryValue]) => {
    select.dataset[key] = String(entryValue);
  });
  for (const option of options) {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    item.title = option.title ?? option.label;
    select.append(item);
  }
  select.value = value ?? "";
  syncInspectorSelectTitle(select);
  select.addEventListener("change", () => {
    syncInspectorSelectTitle(select);
    onChange(select.value);
  });
  row.append(name, select);
  ctx.appendInspectorNode(row);
}

function syncInspectorSelectTitle(select: HTMLSelectElement): void {
  const selected = select.selectedOptions[0];
  select.title = selected?.title || selected?.textContent?.trim() || "";
}

export function installInspectorOwnershipEditorsOwner(
  ctx: ViewerAppContext,
): void {
  ctx.appendTimingOwnershipInspector = appendTimingOwnershipInspector.bind(
    undefined,
    ctx,
  );
  ctx.appendClipOwnershipEditor = appendClipOwnershipEditor.bind(
    undefined,
    ctx,
  );
  ctx.appendPhaseOwnershipEditor = appendPhaseOwnershipEditor.bind(
    undefined,
    ctx,
  );
  ctx.appendTrackOwnershipEditor = appendTrackOwnershipEditor.bind(
    undefined,
    ctx,
  );
  ctx.appendTrackKeyframeActions = appendTrackKeyframeActions.bind(
    undefined,
    ctx,
  );
  ctx.appendKeyframeOwnershipEditor = appendKeyframeOwnershipEditor.bind(
    undefined,
    ctx,
  );
  ctx.appendOwnershipHeading = appendOwnershipHeading.bind(undefined, ctx);
  ctx.createSceneOptions = createSceneOptions.bind(undefined, ctx);
  ctx.createPhaseOptions = createPhaseOptions.bind(undefined, ctx);
  ctx.appendInspectorSelectRow = appendInspectorSelectRow.bind(undefined, ctx);
}
