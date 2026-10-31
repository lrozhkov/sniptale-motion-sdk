import type { ViewerAppContext } from "../app/context.js";
import type { ReloadNotice, ReloadTarget } from "./reload-coordinator.js";
import {
  createStudioReloadCoordinator,
  sourceVersion,
} from "./reload-coordinator.js";
import { prepareStudioEffect } from "./source-preparation.js";
import { addStudioSource, applyStudioSource } from "./source-commit.js";
import {
  getStudioSession,
  parseLocalEffectCatalog,
} from "../effect-file/local-catalog.js";
import {
  getEditorContentFingerprint,
  hasEditorContentChanges,
} from "../editor/draft-fingerprint.js";
import { saveRevision } from "./controller.js";
import {
  STUDIO_CATALOG_ROUTE,
  STUDIO_SESSION_HEADER,
} from "../../../shared/studio/protocol.js";

export function installStudioLiveReload(ctx: ViewerAppContext): void {
  const token = getStudioSession();
  if (!token) return;
  let suspended = false;
  let stopped = false;
  let timer: number | null = null;
  let fetching = false;
  let discovering = false;
  let etag: string | null = null;
  let request: AbortController | null = null;
  let noticeKey = "";
  let noticeIdentity: object | null = null;
  const target = (): ReloadTarget | null => {
    const template = ctx.state.currentTemplate;
    const selection = template
      ? ctx.state.studio.sources.get(template.id)
      : null;
    if (!ctx.state.studio.ready || !template || !selection) return null;
    return {
      identity: template,
      effectId: selection.effectId,
      selection,
      editor: () => ({
        fingerprint: getEditorContentFingerprint(ctx),
        dirty: hasEditorContentChanges(ctx),
      }),
      blocked: () =>
        suspended ||
        stopped ||
        ctx.state.studio.busy ||
        ctx.state.mp4Export.inFlight ||
        ctx.state.previewCacheWarmActive ||
        ctx.state.templateSelectionPending ||
        ctx.state.playing ||
        ctx.state.renderInFlight ||
        ctx.state.rendererContractRefreshing ||
        !ctx.state.sandboxReady ||
        ctx.state.canvasTransformDragActive ||
        ctx.state.timelineDragActive,
    };
  };
  const notice = (state: ReloadNotice) => {
    if (state === "current") {
      noticeKey = "";
      noticeIdentity = null;
      ctx.refs.studioUpdateBar.hidden = true;
      return;
    }
    const template = ctx.state.currentTemplate;
    if (!template || !ctx.state.studio.sources.has(template.id)) return;
    const key = `${template.id}:${state}`;
    if (key === noticeKey) return;
    noticeKey = key;
    noticeIdentity = template;
    ctx.refs.studioUpdateBar.dataset.updateState = state;
    ctx.refs.studioUpdateBar.hidden = false;
    ctx.refs.studioUpdateStatus.textContent = ctx.deps.t(
      `viewer.studio.reload.${state}`,
      state,
    );
    ctx.refs.applyStudioUpdateButton.hidden =
      state !== "pending" && state !== "failed";
    ctx.refs.applyStudioUpdateButton.textContent = ctx.deps.t(
      state === "pending"
        ? "viewer.studio.reload.apply"
        : "viewer.studio.reload.retry",
      state === "pending" ? "Save changes and load update" : "Retry",
    );
  };
  const coordinator = createStudioReloadCoordinator({
    target,
    prepare: (source, current) =>
      prepareStudioEffect(
        ctx,
        source,
        ctx.state.templates.find((template) => template === current.identity) ??
          null,
      ),
    apply: (prepared, source, current, canCommit): Promise<boolean> => {
      const template = ctx.state.templates.find(
        (template) => template === current.identity,
      );
      if (!template) return Promise.resolve(false);
      const editorFingerprint = current.editor().fingerprint;
      // The selection owner checks its own generation after flushing the draft.
      const guard = (): boolean =>
        !stopped &&
        !suspended &&
        coordinator.source(current.effectId) === source &&
        !ctx.state.studio.busy &&
        !ctx.state.playing &&
        !ctx.state.renderInFlight &&
        !ctx.state.rendererContractRefreshing &&
        !ctx.state.mp4Export.inFlight &&
        !ctx.state.previewCacheWarmActive &&
        !ctx.state.canvasTransformDragActive &&
        !ctx.state.timelineDragActive &&
        ctx.state.sandboxReady &&
        ctx.state.currentTemplate === template &&
        current.editor().fingerprint === editorFingerprint;
      return canCommit()
        ? applyStudioSource(ctx, prepared, source, template, guard)
        : Promise.resolve(false);
    },
    notice,
  });
  const discover = async () => {
    if (
      discovering ||
      coordinator.applying ||
      !ctx.state.studio.ready ||
      ctx.state.templateSelectionPending ||
      !ctx.state.sandboxReady ||
      stopped ||
      suspended
    )
      return;
    discovering = true;
    try {
      for (const source of coordinator.entries()) {
        if (
          [...ctx.state.studio.sources.values()].some(
            (selection) => selection.effectId === source.studio.effectId,
          )
        )
          continue;
        const version = sourceVersion(source);
        if (
          ctx.state.studio.discoveryFailures.get(source.studio.effectId) ===
          version
        )
          continue;
        try {
          const prepared = await prepareStudioEffect(ctx, source, null);
          await addStudioSource(
            ctx,
            prepared,
            source,
            () =>
              !stopped &&
              !suspended &&
              coordinator.source(source.studio.effectId) === source &&
              !coordinator.applying,
          );
        } catch {
          ctx.state.studio.discoveryFailures.set(
            source.studio.effectId,
            version,
          );
        }
      }
    } finally {
      discovering = false;
    }
  };
  const poll = async () => {
    if (fetching || stopped || suspended) return;
    fetching = true;
    request = new AbortController();
    try {
      const response = await fetch(STUDIO_CATALOG_ROUTE, {
        cache: "no-store",
        headers: {
          [STUDIO_SESSION_HEADER]: token,
          ...(etag ? { "If-None-Match": etag } : {}),
        },
        signal: request.signal,
      });
      if (stopped || suspended) return;
      let updating: Promise<void>;
      if (response.status === 304) updating = coordinator.sync();
      else {
        if (!response.ok) throw new Error("STUDIO_CATALOG");
        const catalog = parseLocalEffectCatalog(await response.json());
        if (stopped || suspended) return;
        etag = response.headers.get("etag");
        updating = coordinator.accept(catalog);
      }
      void updating.then(discover).catch(() => notice("failed"));
    } catch {
      if (!stopped && !suspended) {
        etag = null;
        coordinator.unavailable();
      }
    } finally {
      fetching = false;
      request = null;
      if (!stopped && !suspended)
        timer = window.setTimeout(() => void poll(), 1000);
    }
  };
  ctx.refs.applyStudioUpdateButton.addEventListener("click", () => {
    void (async () => {
      const current = target();
      if (!current || current.blocked()) return;
      if (noticeIdentity !== current.identity) {
        notice("current");
        return;
      }
      const editor = current.editor();
      ctx.refs.applyStudioUpdateButton.disabled = true;
      try {
        if (editor.dirty) {
          const saved = await saveRevision(ctx);
          if (
            !saved ||
            target()?.identity !== current.identity ||
            current.editor().fingerprint !== editor.fingerprint
          )
            return;
        }
        await coordinator.permitCurrent();
      } finally {
        ctx.refs.applyStudioUpdateButton.disabled = false;
      }
    })().catch(() => notice("failed"));
  });
  window.addEventListener("pagehide", (event) => {
    suspended = true;
    if (timer !== null) window.clearTimeout(timer);
    request?.abort();
    if (!event.persisted) {
      stopped = true;
      coordinator.close();
    }
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && !stopped) {
      suspended = false;
      etag = null;
      void poll();
    }
  });
  void poll();
}
