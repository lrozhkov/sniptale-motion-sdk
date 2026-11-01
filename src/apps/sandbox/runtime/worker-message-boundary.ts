import {
  isValidPresentedFrame,
  isOptionalString,
  isOptionalBoolean,
  isOptionalNonNegativeFiniteNumber,
  isOptionalStringArray,
  isOptionalPreviewCacheStorage,
} from "../../../shared/transport/frame-boundary.js";
import { parseSandboxRenderProfile } from "../../../sdk/render-profile.js";

export type SandboxWorkerResponse =
  | { kind: "workerReady" }
  | {
      kind: "directRenderStarted";
      previewCacheEnabled?: boolean;
      requestId: string;
      sequenceId: number;
    }
  | { kind: "directRenderSettled"; requestId: string }
  | {
      kind: "renderFrameProgress";
      phase: "queued" | "rendering" | "preview-cache-store";
      requestId: string;
      sequenceId: number;
    }
  | {
      compositionIds: string[];
      effectIds: string[];
      error?: string;
      kind: "loadEffectDocumentResult";
      moduleId: string;
      ok: boolean;
      requestId: string;
    }
  | {
      [key: string]: unknown;
      bitmap?: ImageBitmap;
      durationMs: number;
      error?: string;
      kind: "renderFrameResult";
      ok: boolean;
      requestId: string;
      sequenceId: number;
    };

export function parseSandboxWorkerResponse(
  value: unknown,
): SandboxWorkerResponse | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.kind === "workerReady") {
    return { kind: "workerReady" };
  }
  if (
    value.kind === "directRenderStarted" &&
    isOptionalBoolean(value.previewCacheEnabled) &&
    typeof value.requestId === "string" &&
    typeof value.sequenceId === "number" &&
    Number.isFinite(value.sequenceId)
  ) {
    return {
      kind: "directRenderStarted",
      ...(value.previewCacheEnabled === undefined
        ? {}
        : { previewCacheEnabled: value.previewCacheEnabled }),
      requestId: value.requestId,
      sequenceId: value.sequenceId,
    };
  }
  if (
    value.kind === "directRenderSettled" &&
    typeof value.requestId === "string"
  ) {
    return { kind: "directRenderSettled", requestId: value.requestId };
  }
  if (
    value.kind === "renderFrameProgress" &&
    isRenderProgressPhase(value.phase) &&
    typeof value.requestId === "string" &&
    typeof value.sequenceId === "number" &&
    Number.isFinite(value.sequenceId)
  ) {
    return {
      kind: "renderFrameProgress",
      phase: value.phase,
      requestId: value.requestId,
      sequenceId: value.sequenceId,
    };
  }
  if (value.kind === "loadEffectDocumentResult") {
    if (
      typeof value.moduleId !== "string" ||
      typeof value.ok !== "boolean" ||
      typeof value.requestId !== "string" ||
      !isOptionalString(value.error) ||
      !isOptionalStringArray(value.effectIds) ||
      !isOptionalStringArray(value.compositionIds)
    ) {
      return null;
    }
    return {
      compositionIds: value.compositionIds ?? [],
      effectIds: value.effectIds ?? [],
      ...(value.error === undefined ? {} : { error: value.error }),
      kind: "loadEffectDocumentResult",
      moduleId: value.moduleId,
      ok: value.ok,
      requestId: value.requestId,
    };
  }
  if (value.kind === "renderFrameResult") {
    const renderProfile =
      value.renderProfile === undefined
        ? undefined
        : parseSandboxRenderProfile(value.renderProfile);
    if (
      typeof value.ok !== "boolean" ||
      typeof value.requestId !== "string" ||
      typeof value.durationMs !== "number" ||
      !Number.isFinite(value.durationMs) ||
      typeof value.sequenceId !== "number" ||
      !Number.isFinite(value.sequenceId) ||
      !isOptionalString(value.error) ||
      !isOptionalBoolean(value.previewCacheHit) ||
      !isOptionalBoolean(value.previewCacheComplete) ||
      !isOptionalNonNegativeFiniteNumber(value.previewCacheBytes) ||
      !isOptionalNonNegativeFiniteNumber(value.previewCacheEntries) ||
      !isOptionalNonNegativeFiniteNumber(value.previewCacheEvictions) ||
      !isOptionalNonNegativeFiniteNumber(value.previewCacheFrames) ||
      !isOptionalNonNegativeFiniteNumber(value.previewCacheRawBytes) ||
      !isOptionalNonNegativeFiniteNumber(value.previewCacheStoreMs) ||
      !isOptionalNonNegativeFiniteNumber(value.previewCacheTotalFrames) ||
      !isOptionalPreviewCacheStorage(value.previewCacheStorage) ||
      (value.renderProfile !== undefined && !renderProfile) ||
      (value.bitmap !== undefined && !isNativeBitmap(value.bitmap)) ||
      (value.ok && value.bitmap === undefined && !isValidPresentedFrame(value))
    ) {
      return null;
    }
    const { bitmap, ...metadata } = value;
    return {
      ...metadata,
      durationMs: value.durationMs,
      kind: "renderFrameResult",
      ok: value.ok,
      requestId: value.requestId,
      sequenceId: value.sequenceId,
      ...(isNativeBitmap(bitmap) ? { bitmap } : {}),
      ...(renderProfile ? { renderProfile } : {}),
    };
  }
  return null;
}

function isRenderProgressPhase(
  value: unknown,
): value is "queued" | "rendering" | "preview-cache-store" {
  return (
    value === "queued" ||
    value === "rendering" ||
    value === "preview-cache-store"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNativeBitmap(value: unknown): value is ImageBitmap {
  return typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap;
}
