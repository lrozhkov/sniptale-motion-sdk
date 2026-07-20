const MAX_RENDER_DIMENSION = 16_384;
const MAX_RENDER_SEQUENCE = 2_147_483_647;
const MAX_STRUCTURE_NODES = 50_000;
const MAX_STRUCTURE_STRING_CHARS = 3_000_000;
const MAX_STRUCTURE_DEPTH = 32;
const INPUT_FRAME_KEYS = new Set(["from", "next", "previous", "source", "to"]);

type StructuralBudget = {
  active: WeakSet<object>;
  nodes: number;
  stringChars: number;
};

export function hasValidSandboxRenderFields(
  message: Record<string, unknown>,
): boolean {
  const budget = createStructuralBudget();
  return (
    isBoundedString(message.effectId, 128) &&
    isBoundedString(message.requestId, 256) &&
    isRenderDimension(message.width) &&
    isRenderDimension(message.height) &&
    isOptional(message.outputWidth, isRenderDimension) &&
    isOptional(message.outputHeight, isRenderDimension) &&
    isOptional(message.sequenceId, (value) =>
      isSafeIntegerInRange(value, 0, MAX_RENDER_SEQUENCE),
    ) &&
    isOptionalEnum(message.renderQuality, ["full", "reduced"]) &&
    isOptionalBoolean(message.directPresentation) &&
    isOptionalBoolean(message.directResponse) &&
    isOptionalBoolean(message.opaqueBackground) &&
    isOptionalBoolean(message.previewCacheEnabled) &&
    isOptionalBoolean(message.previewCacheWarm) &&
    isOptionalBoolean(message.profileRender) &&
    isOptionalBoolean(message.profileCanvasOperations) &&
    (message.profileCanvasOperations !== true ||
      message.profileRender === true) &&
    isOptional(message.previewCacheRange, isPreviewCacheFrameRange) &&
    isOptionalEnum(message.bindingReadMode, [
      "full",
      "contract",
      "selection",
    ]) &&
    isOptional(message.bindingLayerId, (value) =>
      isBoundedString(value, 256),
    ) &&
    isOptional(message.renderAssetsId, (value) =>
      isBoundedString(value, 128),
    ) &&
    isOptional(message.renderModelId, (value) => isBoundedString(value, 128)) &&
    (message.renderModel === undefined ||
      (message.renderModelId !== undefined &&
        isBoundedStructuredRecord(message.renderModel, budget))) &&
    isOptional(message.assets, (value) => isRenderAssets(value, budget)) &&
    isOptional(message.controls, (value) =>
      isBoundedStructuredRecord(value, budget),
    ) &&
    isOptional(message.inputFrames, (value) =>
      isInputFrameRecord(value, budget),
    ) &&
    isOptional(message.target, (value) => isRenderTarget(value, budget)) &&
    isOptional(message.duration, (value) =>
      isFiniteNumberInRange(value, Number.MIN_VALUE, 86_400),
    ) &&
    isOptional(message.fps, (value) =>
      isFiniteNumberInRange(value, Number.MIN_VALUE, 240),
    ) &&
    isOptional(message.frameIndex, (value) =>
      isSafeIntegerInRange(value, 0, MAX_RENDER_SEQUENCE),
    ) &&
    isOptional(message.progress, (value) =>
      isFiniteNumberInRange(value, 0, 1),
    ) &&
    isOptional(message.time, (value) =>
      isFiniteNumberInRange(value, 0, 86_400),
    ) &&
    isOptional(message.clips, (value) => isRecordArray(value, budget)) &&
    isOptional(message.layers, (value) => isRecordArray(value, budget)) &&
    isOptional(message.scenes, (value) => isRecordArray(value, budget)) &&
    isOptional(message.timeline, (value) =>
      isBoundedStructuredRecord(value, budget),
    )
  );
}

function createStructuralBudget(): StructuralBudget {
  return {
    active: new WeakSet(),
    nodes: MAX_STRUCTURE_NODES,
    stringChars: MAX_STRUCTURE_STRING_CHARS,
  };
}

function isOptional(value: unknown, validate: (value: unknown) => boolean) {
  return value === undefined || validate(value);
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function isOptionalEnum(value: unknown, allowed: readonly string[]): boolean {
  return (
    value === undefined ||
    (typeof value === "string" && allowed.includes(value))
  );
}

function isRenderDimension(value: unknown): value is number {
  return isSafeIntegerInRange(value, 1, MAX_RENDER_DIMENSION);
}

function isPreviewCacheFrameRange(value: unknown): boolean {
  return (
    isRecord(value) &&
    isSafeIntegerInRange(value.startFrame, 0, MAX_RENDER_SEQUENCE) &&
    isSafeIntegerInRange(value.endFrame, 1, MAX_RENDER_SEQUENCE) &&
    value.endFrame > value.startFrame
  );
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= maxLength
  );
}

function isSafeIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isFiniteNumberInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isRenderAssets(value: unknown, budget: StructuralBudget): boolean {
  if (!enterRecord(value, budget, 256)) return false;
  const entries = Object.entries(value);
  const valid = entries.every(
    ([key, asset]) =>
      consumeString(key, budget, 128, true) &&
      isRenderAssetRecord(asset, budget),
  );
  leaveRecord(value, budget);
  return valid;
}

function isRenderAssetRecord(
  value: unknown,
  budget: StructuralBudget,
): boolean {
  if (!enterRecord(value, budget, 64)) return false;
  const valid = Object.entries(value).every(
    ([key, field]) =>
      consumeString(key, budget, 256) &&
      (key === "bitmap"
        ? consumeOpaqueBitmap(field, budget)
        : isBoundedStructuredValue(field, budget, 1)),
  );
  leaveRecord(value, budget);
  return valid;
}

function isInputFrameRecord(value: unknown, budget: StructuralBudget): boolean {
  if (!enterRecord(value, budget, INPUT_FRAME_KEYS.size)) return false;
  const valid = Object.entries(value).every(
    ([key, frame]) =>
      INPUT_FRAME_KEYS.has(key) &&
      consumeString(key, budget, 16, true) &&
      consumeOpaqueBitmap(frame, budget),
  );
  leaveRecord(value, budget);
  return valid;
}

function consumeOpaqueBitmap(
  value: unknown,
  budget: StructuralBudget,
): boolean {
  if (!value || typeof value !== "object" || !consumeNode(budget)) return false;
  const bitmap = value as Record<string, unknown>;
  return (
    typeof bitmap.close === "function" &&
    isFiniteNumberInRange(bitmap.width, 1, 16_384) &&
    isFiniteNumberInRange(bitmap.height, 1, 16_384)
  );
}

function isRenderTarget(value: unknown, budget: StructuralBudget): boolean {
  return (
    isRecord(value) &&
    Object.keys(value).length === 1 &&
    isBoundedString(value.kind, 128) &&
    isBoundedStructuredRecord(value, budget)
  );
}

function isRecordArray(value: unknown, budget: StructuralBudget): boolean {
  return (
    Array.isArray(value) &&
    value.length <= 10_000 &&
    value.every(isRecord) &&
    isBoundedStructuredValue(value, budget, 0)
  );
}

function isBoundedStructuredRecord(
  value: unknown,
  budget: StructuralBudget,
): boolean {
  return isRecord(value) && isBoundedStructuredValue(value, budget, 0);
}

function isBoundedStructuredValue(
  value: unknown,
  budget: StructuralBudget,
  depth: number,
): boolean {
  if (!consumeNode(budget) || depth > MAX_STRUCTURE_DEPTH) return false;
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (typeof value === "string") {
    return consumeString(value, budget, 1_500_000);
  }
  if (Array.isArray(value)) {
    if (value.length > 10_000 || budget.active.has(value)) return false;
    budget.active.add(value);
    const valid = value.every((item) =>
      isBoundedStructuredValue(item, budget, depth + 1),
    );
    budget.active.delete(value);
    return valid;
  }
  if (!isRecord(value) || budget.active.has(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > 10_000) return false;
  budget.active.add(value);
  const valid = entries.every(
    ([key, item]) =>
      consumeString(key, budget, 256) &&
      isBoundedStructuredValue(item, budget, depth + 1),
  );
  budget.active.delete(value);
  return valid;
}

function enterRecord(
  value: unknown,
  budget: StructuralBudget,
  maxEntries: number,
): value is Record<string, unknown> {
  if (
    !isRecord(value) ||
    budget.active.has(value) ||
    Object.keys(value).length > maxEntries ||
    !consumeNode(budget)
  ) {
    return false;
  }
  budget.active.add(value);
  return true;
}

function leaveRecord(value: object, budget: StructuralBudget): void {
  budget.active.delete(value);
}

function consumeNode(budget: StructuralBudget): boolean {
  budget.nodes -= 1;
  return budget.nodes >= 0;
}

function consumeString(
  value: string,
  budget: StructuralBudget,
  maxLength: number,
  requireContent = false,
): boolean {
  if (
    value.length > maxLength ||
    (requireContent && value.length === 0) ||
    budget.stringChars < value.length
  ) {
    return false;
  }
  budget.stringChars -= value.length;
  return true;
}

function isRecord(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
