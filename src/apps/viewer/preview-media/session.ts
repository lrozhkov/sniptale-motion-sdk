import { bindViewerAction } from "../app/bind-action.js";
import type { PreviewMediaActions } from "./contract.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  PREVIEW_MEDIA_SLOTS,
  parsePreviewMediaSlot,
  resolvePreviewMediaSlots,
  type PreviewMediaSlot,
} from "./model.js";
import {
  createPreviewMediaFrameFromEntry,
  disposePreviewMediaEntry,
  loadPreviewMedia,
} from "./frame-source.js";

const MAX_PREVIEW_MEDIA_BYTES = 512 * 1024 * 1024;

function wirePreviewMediaSession(ctx: ViewerAppContext): void {
  for (const input of ctx.refs.previewMediaInputs) {
    input.addEventListener("change", () => void importPreviewMedia(ctx, input));
  }
  for (const button of ctx.refs.previewMediaClearButtons) {
    button.addEventListener("click", () => {
      const slot = parsePreviewMediaSlot(button.dataset.previewMediaClear);
      if (!slot) return;
      clearPreviewMedia(ctx, slot);
    });
  }
  ctx.refs.previewMediaClearAllButton?.addEventListener("click", () =>
    clearAllPreviewMedia(ctx),
  );
  window.addEventListener("beforeunload", () => disposePreviewMedia(ctx));
}

function syncPreviewMediaUi(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null = ctx.state.currentTemplate,
): void {
  const slots = resolvePreviewMediaSlots(template);
  const visibleSlots = new Set(slots);
  ctx.refs.previewMediaMenu.hidden = slots.length === 0;
  if (slots.length === 0) ctx.refs.previewMediaMenu.open = false;
  for (const row of ctx.refs.previewMediaRows) {
    const slot = parsePreviewMediaSlot(row.dataset.previewMediaSlot);
    if (!slot) {
      row.hidden = true;
      continue;
    }
    row.hidden = !visibleSlots.has(slot);
  }
  for (const status of ctx.refs.previewMediaStatuses) {
    const slot = parsePreviewMediaSlot(status.dataset.previewMediaStatus);
    if (!slot) continue;
    const loading = ctx.state.previewMediaLoading.has(slot);
    const error = ctx.state.previewMediaErrors.get(slot);
    const entry = ctx.state.previewMediaInputs.get(slot);
    status.textContent = loading
      ? ctx.deps.t("viewer.preview.media.loading", "Opening…")
      : (error ??
        (entry
          ? entry.fileName
          : ctx.deps.t("viewer.preview.media.fallback", "Sample scene")));
    status.title = error ?? entry?.fileName ?? "";
    status.dataset.state = loading ? "loading" : error ? "error" : "ready";
    status
      .closest("[data-preview-media-slot]")
      ?.setAttribute("aria-busy", String(loading));
  }
  for (const button of ctx.refs.previewMediaClearButtons) {
    const slot = parsePreviewMediaSlot(button.dataset.previewMediaClear);
    if (!slot) {
      button.disabled = true;
      continue;
    }
    button.disabled =
      !ctx.state.previewMediaInputs.has(slot) &&
      !ctx.state.previewMediaLoading.has(slot);
  }
  ctx.refs.previewMediaClearAllButton.disabled =
    ctx.state.previewMediaInputs.size === 0 &&
    ctx.state.previewMediaLoading.size === 0;
  const loadedCount = slots.filter((slot) =>
    ctx.state.previewMediaInputs.has(slot),
  ).length;
  ctx.refs.previewMediaButton.dataset.loadedCount = String(loadedCount);
}

async function importPreviewMedia(
  ctx: ViewerAppContext,
  input: HTMLInputElement,
): Promise<void> {
  const row = input.closest("[data-preview-media-slot]");
  const slot = parsePreviewMediaSlot(
    row instanceof HTMLElement ? row.dataset.previewMediaSlot : undefined,
  );
  const file = input.files?.[0];
  input.value = "";
  if (!slot || !file) return;
  const generation = advancePreviewMediaGeneration(ctx, slot);
  ctx.state.previewMediaErrors.delete(slot);
  ctx.state.previewMediaLoading.add(slot);
  ctx.syncPreviewMediaUi();
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    finishPreviewMediaError(
      ctx,
      slot,
      generation,
      ctx.deps.t(
        "viewer.preview.media.invalid",
        "Choose an image or video file.",
      ),
    );
    return;
  }
  if (file.size > MAX_PREVIEW_MEDIA_BYTES) {
    finishPreviewMediaError(
      ctx,
      slot,
      generation,
      ctx.deps.t(
        "viewer.preview.media.tooLarge",
        "The test media exceeds the 512 MB session limit.",
      ),
    );
    return;
  }
  try {
    const entry = await loadPreviewMedia(file);
    if (!isCurrentPreviewMediaGeneration(ctx, slot, generation)) {
      disposePreviewMediaEntry(entry);
      return;
    }
    if (!resolvePreviewMediaSlots(ctx.state.currentTemplate).includes(slot)) {
      disposePreviewMediaEntry(entry);
      ctx.state.previewMediaLoading.delete(slot);
      ctx.syncPreviewMediaUi();
      return;
    }
    disposePreviewMediaEntry(ctx.state.previewMediaInputs.get(slot));
    ctx.state.previewMediaInputs.set(slot, entry);
    ctx.state.previewMediaErrors.delete(slot);
    ctx.state.previewMediaLoading.delete(slot);
    await refreshPreviewMediaRender(ctx);
  } catch {
    finishPreviewMediaError(
      ctx,
      slot,
      generation,
      ctx.deps.t(
        "viewer.preview.media.loadFailed",
        "The test media could not be opened.",
      ),
    );
  }
}

async function createPreviewMediaFrame(
  ctx: ViewerAppContext,
  slot: PreviewMediaSlot,
  width: number,
  height: number,
  progress: number,
): Promise<ImageBitmap | null> {
  const entry = ctx.state.previewMediaInputs.get(slot);
  if (!entry) return null;
  return createPreviewMediaFrameFromEntry(entry, width, height, progress);
}

function clearPreviewMedia(
  ctx: ViewerAppContext,
  slot: PreviewMediaSlot,
): void {
  advancePreviewMediaGeneration(ctx, slot);
  disposePreviewMediaEntry(ctx.state.previewMediaInputs.get(slot));
  ctx.state.previewMediaInputs.delete(slot);
  ctx.state.previewMediaErrors.delete(slot);
  ctx.state.previewMediaLoading.delete(slot);
  void refreshPreviewMediaRender(ctx);
}

function clearAllPreviewMedia(ctx: ViewerAppContext): void {
  for (const slot of PREVIEW_MEDIA_SLOTS) {
    advancePreviewMediaGeneration(ctx, slot);
    disposePreviewMediaEntry(ctx.state.previewMediaInputs.get(slot));
    ctx.state.previewMediaInputs.delete(slot);
    ctx.state.previewMediaErrors.delete(slot);
    ctx.state.previewMediaLoading.delete(slot);
  }
  void refreshPreviewMediaRender(ctx);
}

function disposePreviewMedia(ctx: ViewerAppContext): void {
  for (const slot of PREVIEW_MEDIA_SLOTS) {
    advancePreviewMediaGeneration(ctx, slot);
  }
  for (const entry of ctx.state.previewMediaInputs.values())
    disposePreviewMediaEntry(entry);
  ctx.state.previewMediaInputs.clear();
  ctx.state.previewMediaErrors.clear();
  ctx.state.previewMediaLoading.clear();
}

async function refreshPreviewMediaRender(ctx: ViewerAppContext): Promise<void> {
  ctx.syncPreviewMediaUi();
  await ctx.invalidatePlaybackVideoCache?.();
  await ctx.renderCurrentFrame({ forceFull: true });
}

function finishPreviewMediaError(
  ctx: ViewerAppContext,
  slot: PreviewMediaSlot,
  generation: number,
  message: string,
): void {
  if (!isCurrentPreviewMediaGeneration(ctx, slot, generation)) return;
  ctx.state.previewMediaLoading.delete(slot);
  ctx.state.previewMediaErrors.set(slot, message);
  ctx.logDiagnostic(message, "error");
  ctx.syncPreviewMediaUi();
}

function advancePreviewMediaGeneration(
  ctx: ViewerAppContext,
  slot: PreviewMediaSlot,
): number {
  const generation =
    Number(ctx.state.previewMediaLoadGeneration.get(slot) ?? 0) + 1;
  ctx.state.previewMediaLoadGeneration.set(slot, generation);
  return generation;
}

function isCurrentPreviewMediaGeneration(
  ctx: ViewerAppContext,
  slot: PreviewMediaSlot,
  generation: number,
): boolean {
  return ctx.state.previewMediaLoadGeneration.get(slot) === generation;
}

export function createPreviewMediaActions(
  getContext: () => ViewerAppContext,
): PreviewMediaActions {
  return {
    createPreviewMediaFrame: bindViewerAction(
      createPreviewMediaFrame,
      getContext,
    ),
    syncPreviewMediaUi: bindViewerAction(syncPreviewMediaUi, getContext),
    wirePreviewMediaSession: bindViewerAction(
      wirePreviewMediaSession,
      getContext,
    ),
  };
}
