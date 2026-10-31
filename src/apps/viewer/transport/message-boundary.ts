import type { SandboxRenderProfile } from "../../../sdk/render-profile.js";
import { MessageKind } from "../../../sdk/protocol.js";
import { parseSandboxRenderProfile } from "../../../sdk/render-profile.js";

export type ViewerSandboxMessage =
  | { kind: "runtimeReady" }
  | {
      error?: string;
      kind: "validateEffectDocumentResult";
      ok: boolean;
      requestId: string;
    }
  | {
      kind: "renderFrameProgress";
      phase: "queued" | "rendering" | "preview-cache-store";
      requestId: string;
      sequenceId: number;
    }
  | {
      compositionIds: string[];
      effectIds: string[];
      errorCode?: string;
      error?: string;
      executionMode?: "worker";
      kind: "loadEffectDocumentResult";
      moduleId: string;
      ok: boolean;
      requestId: string;
    }
  | {
      [key: string]: unknown;
      presented?: unknown;
      presentedAtMs?: unknown;
      presentedAtEpochMs?: unknown;
      previewWidth?: unknown;
      previewHeight?: unknown;
      previewCacheHit?: unknown;
      previewCacheComplete?: unknown;
      previewCacheFrames?: unknown;
      bitmap?: ImageBitmap | undefined;
      renderProfile?: SandboxRenderProfile | undefined;
      durationMs: number;
      errorCode?: string;
      error?: string;
      kind: "renderFrameResult";
      ok: boolean;
      requestId: string;
      sequenceId: number;
    };

export function parseViewerSandboxMessage(
  value: unknown,
): ViewerSandboxMessage | null {
  if (!isRecord(value)) {
    return null;
  }
  const message = value;
  if (message.kind === MessageKind.RUNTIME_READY) {
    return { kind: "runtimeReady" };
  }
  if (message.kind === MessageKind.VALIDATE_EFFECT_DOCUMENT_RESULT) {
    if (
      typeof message.ok !== "boolean" ||
      typeof message.requestId !== "string" ||
      !isOptionalString(message.error)
    ) {
      return null;
    }
    return {
      ...(message.error === undefined ? {} : { error: message.error }),
      kind: "validateEffectDocumentResult",
      ok: message.ok,
      requestId: message.requestId,
    };
  }
  if (message.kind === MessageKind.RENDER_FRAME_PROGRESS) {
    if (
      !isRenderProgressPhase(message.phase) ||
      typeof message.requestId !== "string" ||
      typeof message.sequenceId !== "number" ||
      !Number.isFinite(message.sequenceId)
    ) {
      return null;
    }
    return {
      kind: "renderFrameProgress",
      phase: message.phase,
      requestId: message.requestId,
      sequenceId: message.sequenceId,
    };
  }
  if (message.kind === MessageKind.LOAD_EFFECT_DOCUMENT_RESULT) {
    if (
      typeof message.moduleId !== "string" ||
      typeof message.ok !== "boolean" ||
      typeof message.requestId !== "string" ||
      !isOptionalString(message.error) ||
      !isOptionalString(message.errorCode) ||
      (message.executionMode !== undefined &&
        message.executionMode !== "worker") ||
      !isOptionalStringArray(message.effectIds) ||
      !isOptionalStringArray(message.compositionIds)
    ) {
      return null;
    }
    return {
      compositionIds: message.compositionIds ?? [],
      effectIds: message.effectIds ?? [],
      ...(message.error === undefined ? {} : { error: message.error }),
      ...(message.errorCode === undefined
        ? {}
        : { errorCode: message.errorCode }),
      ...(message.executionMode === undefined
        ? {}
        : { executionMode: "worker" as const }),
      kind: "loadEffectDocumentResult",
      moduleId: message.moduleId,
      ok: message.ok,
      requestId: message.requestId,
    };
  }
  if (message.kind === MessageKind.RENDER_FRAME_RESULT) {
    const bitmap =
      message.bitmap == null
        ? undefined
        : typeof ImageBitmap !== "undefined" &&
            message.bitmap instanceof ImageBitmap
          ? message.bitmap
          : null;
    const renderProfile =
      message.renderProfile === undefined
        ? undefined
        : parseSandboxRenderProfile(message.renderProfile);
    if (
      bitmap === null ||
      typeof message.ok !== "boolean" ||
      typeof message.requestId !== "string" ||
      typeof message.durationMs !== "number" ||
      !Number.isFinite(message.durationMs) ||
      typeof message.sequenceId !== "number" ||
      !Number.isFinite(message.sequenceId) ||
      !isOptionalString(message.error) ||
      !isOptionalString(message.errorCode) ||
      !isOptionalBoolean(message.previewCacheHit) ||
      !isOptionalBoolean(message.previewCacheComplete) ||
      !isOptionalNonNegativeFiniteNumber(message.previewCacheBytes) ||
      !isOptionalNonNegativeFiniteNumber(message.previewCacheEntries) ||
      !isOptionalNonNegativeFiniteNumber(message.previewCacheEvictions) ||
      !isOptionalNonNegativeFiniteNumber(message.previewCacheFrames) ||
      !isOptionalNonNegativeFiniteNumber(message.previewCacheRawBytes) ||
      !isOptionalNonNegativeFiniteNumber(message.previewCacheStoreMs) ||
      !isOptionalNonNegativeFiniteNumber(message.previewCacheTotalFrames) ||
      !isOptionalPreviewCacheStorage(message.previewCacheStorage) ||
      (message.renderProfile !== undefined && !renderProfile) ||
      (message.ok && !bitmap && !isValidPresentedFrame(message))
    ) {
      return null;
    }
    return {
      ...message,
      bitmap,
      durationMs: message.durationMs,
      ...(message.error === undefined ? {} : { error: message.error }),
      ...(message.errorCode === undefined
        ? {}
        : { errorCode: message.errorCode }),
      kind: "renderFrameResult",
      ok: message.ok,
      requestId: message.requestId,
      renderProfile: renderProfile ?? undefined,
      sequenceId: message.sequenceId,
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

function isValidPresentedFrame(value: Record<string, unknown>): boolean {
  return (
    value.presented === true &&
    // This field was added after direct presentation shipped. Keep it
    // optional so a live viewer update can still consume an older worker.
    (value.presentedAtEpochMs === undefined ||
      (typeof value.presentedAtEpochMs === "number" &&
        Number.isFinite(value.presentedAtEpochMs) &&
        value.presentedAtEpochMs > 0)) &&
    typeof value.presentedAtMs === "number" &&
    Number.isFinite(value.presentedAtMs) &&
    value.presentedAtMs >= 0 &&
    typeof value.previewWidth === "number" &&
    Number.isFinite(value.previewWidth) &&
    value.previewWidth > 0 &&
    typeof value.previewHeight === "number" &&
    Number.isFinite(value.previewHeight) &&
    value.previewHeight > 0
  );
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}

function isOptionalNonNegativeFiniteNumber(
  value: unknown,
): value is number | undefined {
  return (
    value === undefined ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0)
  );
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

function isOptionalPreviewCacheStorage(
  value: unknown,
): value is "bitmap" | "mixed" | "none" | "png" | undefined {
  return (
    value === undefined ||
    value === "bitmap" ||
    value === "mixed" ||
    value === "none" ||
    value === "png"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Rejected browser messages must release transferred native resources. */
export function discardSandboxMessageBitmap(value: unknown): void {
  if (
    isRecord(value) &&
    typeof ImageBitmap !== "undefined" &&
    value.bitmap instanceof ImageBitmap
  )
    value.bitmap.close();
}
