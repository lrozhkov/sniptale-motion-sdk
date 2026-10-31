export type ValidationRange = { start?: number; duration?: number };
export type ValidationScene = ValidationRange & { id: string };
export type ValidationPhase = ValidationScene & { sceneId?: string | null };
export type ValidationLayer = Record<string, unknown> & {
  id: string;
  type?: string;
  parentId?: string | null;
  assetId?: string | null;
};
export type ValidationClip = ValidationRange & {
  layerId?: string | null;
  sceneId?: string | null;
};
export type ValidationKeyframe = {
  id?: string;
  time?: number;
  phaseId?: string | null;
  sceneId?: string | null;
};
export type ValidationTrack = {
  id: string;
  layerId?: string | null;
  target?: string;
  phaseId?: string | null;
  sceneId?: string | null;
  keyframes?: ValidationKeyframe[];
};
export type ValidationTimeline = {
  phases?: ValidationPhase[];
  tracks?: ValidationTrack[];
};
export type ValidationTemplate = {
  duration?: number;
  kind?: string;
  layers?: ValidationLayer[];
  clips?: ValidationClip[];
  scenes?: ValidationScene[];
  timeline?: ValidationTimeline;
  assets?: string[];
  controls?: { id: string }[];
  presets?: unknown[];
};

export function isValidationRecord(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

type Reject = (path: string) => false;
type Check = (value: unknown, path: string, reject: Reject) => boolean;

export function readValidationTemplate(
  value: unknown,
):
  | { template: ValidationTemplate; errorPath: null }
  | { template: null; errorPath: string } {
  let errorPath = "$";
  if (
    isValidationTemplate(value, (path) => {
      errorPath = path;
      return false;
    })
  ) {
    return { template: value, errorPath: null };
  }
  return { template: null, errorPath };
}
function isValidationTemplate(
  value: unknown,
  reject: Reject,
): value is ValidationTemplate {
  return isValidationRecord(value)
    ? numbers(value, ["duration"], "$", reject) &&
        strings(value, ["kind"], "$", reject) &&
        collection(value.layers, "$.layers", isLayer, reject) &&
        collection(value.clips, "$.clips", isClip, reject) &&
        collection(value.scenes, "$.scenes", isScene, reject) &&
        (value.timeline === undefined ||
          isTimeline(value.timeline, "$.timeline", reject)) &&
        collection(
          value.assets,
          "$.assets",
          (item, path, fail) => typeof item === "string" || fail(path),
          reject,
        ) &&
        collection(value.controls, "$.controls", hasId, reject) &&
        (value.presets === undefined ||
          Array.isArray(value.presets) ||
          reject("$.presets"))
    : reject("$");
}
function collection(
  value: unknown,
  path: string,
  check: Check,
  reject: Reject,
): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return reject(path);
  for (const [index, item] of value.entries()) {
    if (!check(item, `${path}[${index}]`, reject)) return false;
  }
  return true;
}
function strings(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  reject: Reject,
  nullable = false,
): boolean {
  return keys.every(
    (key) =>
      value[key] === undefined ||
      (nullable && value[key] === null) ||
      typeof value[key] === "string" ||
      reject(`${path}.${key}`),
  );
}
function numbers(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  reject: Reject,
): boolean {
  return keys.every(
    (key) =>
      value[key] === undefined ||
      (typeof value[key] === "number" && Number.isFinite(value[key])) ||
      reject(`${path}.${key}`),
  );
}
function hasId(
  value: unknown,
  path: string,
  reject: Reject,
): value is Record<string, unknown> & { id: string } {
  return isValidationRecord(value)
    ? typeof value.id === "string" || reject(`${path}.id`)
    : reject(path);
}
function isLayer(value: unknown, path: string, reject: Reject): boolean {
  return (
    hasId(value, path, reject) &&
    strings(value, ["type"], path, reject) &&
    strings(value, ["parentId", "assetId"], path, reject, true)
  );
}
function isClip(value: unknown, path: string, reject: Reject): boolean {
  return isValidationRecord(value)
    ? numbers(value, ["start", "duration"], path, reject) &&
        strings(value, ["layerId", "sceneId"], path, reject, true)
    : reject(path);
}
function isScene(value: unknown, path: string, reject: Reject): boolean {
  return (
    hasId(value, path, reject) &&
    numbers(value, ["start", "duration"], path, reject)
  );
}
function isPhase(value: unknown, path: string, reject: Reject): boolean {
  return (
    hasId(value, path, reject) &&
    numbers(value, ["start", "duration"], path, reject) &&
    strings(value, ["sceneId"], path, reject, true)
  );
}
function isTrack(value: unknown, path: string, reject: Reject): boolean {
  return (
    hasId(value, path, reject) &&
    strings(value, ["target"], path, reject) &&
    strings(value, ["layerId", "sceneId", "phaseId"], path, reject, true) &&
    collection(value.keyframes, `${path}.keyframes`, isKeyframe, reject)
  );
}
function isKeyframe(value: unknown, path: string, reject: Reject): boolean {
  return isValidationRecord(value)
    ? strings(value, ["id"], path, reject) &&
        strings(value, ["phaseId", "sceneId"], path, reject, true) &&
        numbers(value, ["time"], path, reject)
    : reject(path);
}
function isTimeline(value: unknown, path: string, reject: Reject): boolean {
  return isValidationRecord(value)
    ? collection(value.phases, `${path}.phases`, isPhase, reject) &&
        collection(value.tracks, `${path}.tracks`, isTrack, reject)
    : reject(path);
}
