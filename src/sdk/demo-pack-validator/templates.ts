import { isRecord, isSafeLocalPath, push } from "./common.js";
import { validateTimelineMotionPaths } from "./motion-paths.js";
import { readJson } from "./readers.js";

const TEMPLATE_KINDS = new Set([
  "composition",
  "layerEffect",
  "overlay",
  "sceneEffect",
  "transitionEffect",
]);
const LAYER_EDITOR_CANVAS_MODES = new Set(["bounds", "fullFrame", "none"]);
const LAYER_EDITOR_OPERATIONS = new Set(["delete", "duplicate", "reorder"]);
const LAYER_EDITOR_TRANSFORMS = new Set([
  "anchorX",
  "anchorY",
  "rotation",
  "scaleX",
  "scaleY",
  "x",
  "y",
]);
const MAX_LAYER_GROUP_DEPTH = 8;

export async function readTemplates(baseUrl, manifest, errors) {
  if (!Array.isArray(manifest.templates)) {
    return [];
  }
  const templates = [];
  for (const path of manifest.templates) {
    if (!isSafeLocalPath(path)) {
      continue;
    }
    const template = await readJson(`${baseUrl}${path}`, errors, path);
    if (template) {
      validateTemplate(template, path, errors);
      templates.push(template);
    }
  }
  return templates;
}

export function validateTemplateModuleRefs(manifest, templates, errors) {
  const moduleIds = new Set((manifest.modules ?? []).map((entry) => entry.id));
  for (const template of templates) {
    if (!moduleIds.has(template.moduleId)) {
      push(
        errors,
        `templates.${template.id}.moduleId`,
        `Unknown module ${template.moduleId}.`,
      );
    }
  }
}

function validateTemplate(template, path, errors) {
  if (!isRecord(template)) {
    push(errors, path, "Expected template object.");
    return;
  }
  for (const key of ["id", "category", "kind", "moduleId", "effectId"]) {
    if (typeof template[key] !== "string" || template[key].trim() === "") {
      push(errors, `${path}.${key}`, "Expected non-empty string.");
    }
  }
  if (typeof template.kind === "string" && !TEMPLATE_KINDS.has(template.kind)) {
    push(errors, `${path}.kind`, "Expected known template kind.");
  }
  if (typeof template.duration !== "number" || template.duration <= 0) {
    push(errors, `${path}.duration`, "Expected positive duration.");
  }
  if (!Array.isArray(template.controls)) {
    push(errors, `${path}.controls`, "Expected controls array.");
  }
  if (template.kind === "composition") {
    validateCompositionTemplate(template, path, errors);
  }
  if (template.layers !== undefined) {
    validateLayers(template.layers, path, errors);
  }
  if (template.clips !== undefined) {
    validateClips(template, path, errors);
  }
  if (template.timeline !== undefined) {
    validateTimelineTemplate(template, path, errors);
  }
  if (template.assets !== undefined && !Array.isArray(template.assets)) {
    push(errors, `${path}.assets`, "Expected asset id list.");
  }
}

function validateCompositionTemplate(template, path, errors) {
  if (!Array.isArray(template.scenes) || template.scenes.length === 0) {
    push(errors, `${path}.scenes`, "Expected composition scene list.");
    return;
  }
  for (let index = 0; index < template.scenes.length; index += 1) {
    const scene = template.scenes[index];
    const scenePath = `${path}.scenes.${index}`;
    if (!isRecord(scene)) {
      push(errors, scenePath, "Expected scene object.");
      continue;
    }
    if (typeof scene.id !== "string" || scene.id.trim() === "") {
      push(errors, `${scenePath}.id`, "Expected scene id.");
    }
    if (typeof scene.start !== "number" || scene.start < 0) {
      push(errors, `${scenePath}.start`, "Expected non-negative start.");
    }
    if (typeof scene.duration !== "number" || scene.duration <= 0) {
      push(errors, `${scenePath}.duration`, "Expected positive duration.");
    }
    if (scene.enabled !== undefined && typeof scene.enabled !== "boolean") {
      push(errors, `${scenePath}.enabled`, "Expected enabled boolean.");
    }
  }
}

function validateLayers(layers, path, errors) {
  if (!Array.isArray(layers)) {
    push(errors, `${path}.layers`, "Expected layer list.");
    return;
  }
  const ids = new Set();
  layers.forEach((layer, index) => {
    const layerPath = `${path}.layers.${index}`;
    if (!isRecord(layer)) {
      push(errors, layerPath, "Expected layer object.");
      return;
    }
    if (typeof layer.id !== "string" || layer.id.trim() === "") {
      push(errors, `${layerPath}.id`, "Expected layer id.");
    } else if (ids.has(layer.id)) {
      push(errors, `${layerPath}.id`, `Duplicate layer id ${layer.id}.`);
    } else {
      ids.add(layer.id);
    }
    if (typeof layer.name !== "string" || layer.name.trim() === "") {
      push(errors, `${layerPath}.name`, "Expected layer name.");
    }
    if (typeof layer.type !== "string" || layer.type.trim() === "") {
      push(errors, `${layerPath}.type`, "Expected layer type.");
    }
    if (layer.visible !== undefined && typeof layer.visible !== "boolean") {
      push(errors, `${layerPath}.visible`, "Expected visible boolean.");
    }
    if (layer.locked !== undefined && typeof layer.locked !== "boolean") {
      push(errors, `${layerPath}.locked`, "Expected locked boolean.");
    }
    if (layer.editor !== undefined) {
      validateLayerEditorDefinition(
        layer.editor,
        `${layerPath}.editor`,
        errors,
      );
    }
    if (
      layer.svgPartMode !== undefined &&
      !["none", "reveal", "scatter"].includes(layer.svgPartMode)
    ) {
      push(errors, `${layerPath}.svgPartMode`, "Expected known SVG part mode.");
    }
    if (
      layer.partOrder !== undefined &&
      !["document", "reverse", "center", "edges", "random"].includes(
        layer.partOrder,
      )
    ) {
      push(errors, `${layerPath}.partOrder`, "Expected known SVG part order.");
    }
    for (const key of [
      "x",
      "y",
      "baseX",
      "baseY",
      "anchorX",
      "anchorY",
      "scaleX",
      "scaleY",
      "rotation",
      "opacity",
      "blur",
      "partReveal",
      "partStagger",
      "partSpread",
      "partBlur",
    ]) {
      if (layer[key] !== undefined && !Number.isFinite(Number(layer[key]))) {
        push(
          errors,
          `${layerPath}.${key}`,
          "Expected finite numeric layer transform.",
        );
      }
    }
  });
  validateLayerHierarchy(layers, path, errors);
}

function validateLayerHierarchy(layers, path, errors) {
  const records = layers.filter(isRecord) as any[];
  const byId = new Map<string, any>(records.map((layer) => [layer.id, layer]));
  const indexById = new Map<string, number>(
    records.map((layer) => [layer.id, layers.indexOf(layer)]),
  );
  const childrenByParent = new Map<string, any[]>();
  for (const layer of records) {
    const layerIndex = layers.indexOf(layer);
    if (
      layer.parentId !== undefined &&
      layer.parentId !== null &&
      typeof layer.parentId !== "string"
    ) {
      push(
        errors,
        `${path}.layers.${layerIndex}.parentId`,
        "Expected parent layer id.",
      );
      continue;
    }
    if (!layer.parentId) {
      continue;
    }
    const parent = byId.get(layer.parentId);
    if (!parent) {
      push(
        errors,
        `${path}.layers.${layerIndex}.parentId`,
        `Unknown parent ${layer.parentId}.`,
      );
    } else if (parent.type !== "group") {
      push(
        errors,
        `${path}.layers.${layerIndex}.parentId`,
        `Parent ${layer.parentId} must be a group.`,
      );
    }
    const children = childrenByParent.get(layer.parentId) ?? [];
    children.push(layer);
    childrenByParent.set(layer.parentId, children);
  }
  for (const layer of records) {
    const layerIndex = layers.indexOf(layer);
    const visited = new Set();
    let current: any = layer;
    let depth = 0;
    while (current?.parentId && byId.has(current.parentId)) {
      if (visited.has(current.id)) {
        push(
          errors,
          `${path}.layers.${layerIndex}.parentId`,
          `Layer hierarchy contains a cycle at ${layer.id}.`,
        );
        break;
      }
      visited.add(current.id);
      depth += 1;
      current = byId.get(current.parentId);
    }
    if (depth > MAX_LAYER_GROUP_DEPTH) {
      push(
        errors,
        `${path}.layers.${layerIndex}.parentId`,
        `Layer hierarchy exceeds depth ${MAX_LAYER_GROUP_DEPTH}.`,
      );
    }
    if (layer.type !== "group") {
      continue;
    }
    const subtreeIds: string[] = [];
    const subtreeVisited = new Set<string>();
    const visit = (id: string) => {
      if (subtreeVisited.has(id)) return;
      subtreeVisited.add(id);
      subtreeIds.push(id);
      for (const child of childrenByParent.get(id) ?? []) {
        visit(child.id);
      }
    };
    visit(layer.id);
    const indexes = subtreeIds
      .map((id) => indexById.get(id))
      .filter((index): index is number => Number.isInteger(index))
      .sort((a, b) => a - b);
    const rootIndex = indexById.get(layer.id);
    if (
      indexes.length !== subtreeIds.length ||
      indexes[0] !== rootIndex ||
      indexes.some((index, offset) => index !== rootIndex + offset)
    ) {
      push(
        errors,
        `${path}.layers.${layerIndex}`,
        `Group ${layer.id} must own one contiguous layer subtree.`,
      );
    }
  }
}

export function validateLayerEditorDefinition(editor, path, errors) {
  if (!isRecord(editor)) {
    push(errors, path, "Expected layer editor capability object.");
    return;
  }
  if (
    editor.canvas !== undefined &&
    !LAYER_EDITOR_CANVAS_MODES.has(editor.canvas)
  ) {
    push(errors, `${path}.canvas`, "Expected known canvas mode.");
  }
  validateKnownStringList(
    editor.transform,
    `${path}.transform`,
    LAYER_EDITOR_TRANSFORMS,
    errors,
  );
  validateKnownStringList(
    editor.operations,
    `${path}.operations`,
    LAYER_EDITOR_OPERATIONS,
    errors,
  );
  validateStringList(editor.properties, `${path}.properties`, errors);
  validateStringList(
    editor.keyframeProperties,
    `${path}.keyframeProperties`,
    errors,
  );
}

function validateStringList(value, path, errors) {
  if (value === undefined) {
    return;
  }
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.trim() === "")
  ) {
    push(errors, path, "Expected non-empty string list.");
  }
}

function validateKnownStringList(value, path, allowed, errors) {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    push(errors, path, "Expected capability list.");
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== "string" || !allowed.has(item)) {
      push(errors, `${path}.${index}`, "Expected known capability.");
    }
  });
}

function validateClips(template, path, errors) {
  if (!Array.isArray(template.clips)) {
    push(errors, `${path}.clips`, "Expected clip list.");
    return;
  }
  const layerIds = new Set(
    (template.layers ?? []).filter(isRecord).map((layer) => layer.id),
  );
  const groupIds = new Set(
    (template.layers ?? [])
      .filter(isRecord)
      .filter((layer) => layer.type === "group")
      .map((layer) => layer.id),
  );
  const sceneIds = new Set(
    (template.scenes ?? []).filter(isRecord).map((scene) => scene.id),
  );
  template.clips.forEach((clip, index) => {
    const clipPath = `${path}.clips.${index}`;
    if (!isRecord(clip)) {
      push(errors, clipPath, "Expected clip object.");
      return;
    }
    if (typeof clip.layerId !== "string" || clip.layerId.trim() === "") {
      push(errors, `${clipPath}.layerId`, "Expected layer id.");
    } else if (layerIds.size > 0 && !layerIds.has(clip.layerId)) {
      push(errors, `${clipPath}.layerId`, `Unknown layer ${clip.layerId}.`);
    } else if (groupIds.has(clip.layerId)) {
      push(errors, `${clipPath}.layerId`, "Groups cannot own clips.");
    }
    if (
      clip.sceneId !== undefined &&
      clip.sceneId !== null &&
      !sceneIds.has(clip.sceneId)
    ) {
      push(errors, `${clipPath}.sceneId`, `Unknown scene ${clip.sceneId}.`);
    }
    if (typeof clip.start !== "number" || clip.start < 0) {
      push(errors, `${clipPath}.start`, "Expected non-negative start.");
    }
    if (typeof clip.duration !== "number" || clip.duration <= 0) {
      push(errors, `${clipPath}.duration`, "Expected positive duration.");
    }
    if (clip.offset !== undefined && typeof clip.offset !== "number") {
      push(errors, `${clipPath}.offset`, "Expected numeric offset.");
    }
    if (clip.locked !== undefined && typeof clip.locked !== "boolean") {
      push(errors, `${clipPath}.locked`, "Expected locked boolean.");
    }
    if (clip.enabled !== undefined && typeof clip.enabled !== "boolean") {
      push(errors, `${clipPath}.enabled`, "Expected enabled boolean.");
    }
  });
}

function validateTimelineTemplate(template, path, errors) {
  if (!isRecord(template.timeline)) {
    push(errors, `${path}.timeline`, "Expected timeline object.");
    return;
  }
  if (!Array.isArray(template.timeline.phases)) {
    push(errors, `${path}.timeline.phases`, "Expected phase list.");
  } else {
    const sceneIds = new Set(
      (template.scenes ?? []).filter(isRecord).map((scene) => scene.id),
    );
    template.timeline.phases.forEach((phase, index) =>
      validateTimelinePhase(
        phase,
        `${path}.timeline.phases.${index}`,
        template.duration,
        sceneIds,
        errors,
      ),
    );
  }
  if (!Array.isArray(template.timeline.tracks)) {
    push(errors, `${path}.timeline.tracks`, "Expected track list.");
  } else {
    const phaseIds = new Set(
      (template.timeline.phases ?? [])
        .filter(isRecord)
        .map((phase) => phase.id),
    );
    const sceneIds = new Set(
      (template.scenes ?? []).filter(isRecord).map((scene) => scene.id),
    );
    const groupIds = new Set(
      (template.layers ?? [])
        .filter(isRecord)
        .filter((layer) => layer.type === "group")
        .map((layer) => layer.id),
    );
    template.timeline.tracks.forEach((track, index) =>
      validateTimelineTrack(
        track,
        `${path}.timeline.tracks.${index}`,
        template.duration,
        phaseIds,
        sceneIds,
        groupIds,
        errors,
      ),
    );
  }
  validateTimelineMotionPaths(template, path, errors);
}

function validateTimelinePhase(phase, path, duration, sceneIds, errors) {
  if (!isRecord(phase)) {
    push(errors, path, "Expected phase object.");
    return;
  }
  if (typeof phase.id !== "string" || phase.id.trim() === "") {
    push(errors, `${path}.id`, "Expected phase id.");
  }
  if (typeof phase.label !== "string" || phase.label.trim() === "") {
    push(errors, `${path}.label`, "Expected phase label.");
  }
  if (
    typeof phase.start !== "number" ||
    phase.start < 0 ||
    phase.start > duration
  ) {
    push(errors, `${path}.start`, "Expected start within template duration.");
  }
  if (
    typeof phase.duration !== "number" ||
    phase.duration <= 0 ||
    phase.start + phase.duration > duration + 0.001
  ) {
    push(
      errors,
      `${path}.duration`,
      "Expected positive duration inside template duration.",
    );
  }
  if (phase.locked !== undefined && typeof phase.locked !== "boolean") {
    push(errors, `${path}.locked`, "Expected boolean locked flag.");
  }
  if (phase.enabled !== undefined && typeof phase.enabled !== "boolean") {
    push(errors, `${path}.enabled`, "Expected boolean enabled flag.");
  }
  if (
    phase.sceneId !== undefined &&
    phase.sceneId !== null &&
    !sceneIds.has(phase.sceneId)
  ) {
    push(errors, `${path}.sceneId`, `Unknown scene ${phase.sceneId}.`);
  }
}

function validateTimelineTrack(
  track,
  path,
  duration,
  phaseIds,
  sceneIds,
  groupIds,
  errors,
) {
  if (!isRecord(track)) {
    push(errors, path, "Expected track object.");
    return;
  }
  for (const key of ["id", "label", "target", "property"]) {
    if (typeof track[key] !== "string" || track[key].trim() === "") {
      push(errors, `${path}.${key}`, "Expected non-empty string.");
    }
  }
  const ownerId =
    typeof track.layerId === "string"
      ? track.layerId
      : typeof track.target === "string" && track.target !== "scene"
        ? track.target
        : null;
  if (ownerId && groupIds.has(ownerId)) {
    push(errors, `${path}.target`, "Groups cannot own animation tracks.");
  }
  if (
    track.phaseId !== undefined &&
    track.phaseId !== null &&
    !phaseIds.has(track.phaseId)
  ) {
    push(errors, `${path}.phaseId`, `Unknown phase ${track.phaseId}.`);
  }
  if (
    track.sceneId !== undefined &&
    track.sceneId !== null &&
    !sceneIds.has(track.sceneId)
  ) {
    push(errors, `${path}.sceneId`, `Unknown scene ${track.sceneId}.`);
  }
  if (track.enabled !== undefined && typeof track.enabled !== "boolean") {
    push(errors, `${path}.enabled`, "Expected boolean enabled flag.");
  }
  if (!Array.isArray(track.keyframes) || track.keyframes.length === 0) {
    push(errors, `${path}.keyframes`, "Expected keyframe list.");
    return;
  }
  track.keyframes.forEach((keyframe, index) =>
    validateTimelineKeyframe(
      keyframe,
      `${path}.keyframes.${index}`,
      duration,
      phaseIds,
      sceneIds,
      errors,
    ),
  );
}

function validateTimelineKeyframe(
  keyframe,
  path,
  duration,
  phaseIds,
  sceneIds,
  errors,
) {
  if (!isRecord(keyframe)) {
    push(errors, path, "Expected keyframe object.");
    return;
  }
  if (typeof keyframe.id !== "string" || keyframe.id.trim() === "") {
    push(errors, `${path}.id`, "Expected keyframe id.");
  }
  if (
    typeof keyframe.time !== "number" ||
    keyframe.time < 0 ||
    keyframe.time > duration
  ) {
    push(errors, `${path}.time`, "Expected time within template duration.");
  }
  if (keyframe.value === undefined) {
    push(errors, `${path}.value`, "Expected keyframe value.");
  }
  if (keyframe.easing !== undefined && typeof keyframe.easing !== "string") {
    push(errors, `${path}.easing`, "Expected easing string.");
  }
  if (keyframe.enabled !== undefined && typeof keyframe.enabled !== "boolean") {
    push(errors, `${path}.enabled`, "Expected boolean enabled flag.");
  }
  if (
    keyframe.phaseId !== undefined &&
    keyframe.phaseId !== null &&
    !phaseIds.has(keyframe.phaseId)
  ) {
    push(errors, `${path}.phaseId`, `Unknown phase ${keyframe.phaseId}.`);
  }
  if (
    keyframe.sceneId !== undefined &&
    keyframe.sceneId !== null &&
    !sceneIds.has(keyframe.sceneId)
  ) {
    push(errors, `${path}.sceneId`, `Unknown scene ${keyframe.sceneId}.`);
  }
  if (keyframe.handles !== undefined) {
    validateTimelineHandles(keyframe.handles, `${path}.handles`, errors);
  }
}

function validateTimelineHandles(handles, path, errors) {
  if (!isRecord(handles)) {
    push(errors, path, "Expected handles object.");
    return;
  }
  for (const key of ["x1", "y1", "x2", "y2"]) {
    if (
      typeof handles[key] !== "number" ||
      handles[key] < 0 ||
      handles[key] > 1
    ) {
      push(errors, `${path}.${key}`, "Expected normalized handle number.");
    }
  }
}
