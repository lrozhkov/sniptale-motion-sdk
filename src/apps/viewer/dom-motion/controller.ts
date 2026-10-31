import type { DomMotionActions } from "./contract.js";
import { readEditorTemplateSource } from "../templates/source.js";
import {
  createDomMotionSurface,
  parseDomMotionDocument,
  type DomMotionSurface,
} from "../../../sdk/dom-motion/index.js";
import type { ViewerAppContext } from "../app/context.js";
import { includesLocalEffects } from "../app/build-flags.js";
import {
  createDomMotionTemplate,
  readDomMotionTemplateDocument,
} from "./template.js";
import { loadLocalDomMotionCatalog } from "./catalog.js";

type Session = {
  source: ViewerAppContext["state"]["currentTemplate"];
  generation: number;
  templateId: string;
  surface: DomMotionSurface;
  ready: boolean;
};
export function createDomMotionActions(
  getContext: () => ViewerAppContext,
): DomMotionActions {
  let session: Session | null = null;
  function dispose() {
    session?.surface.dispose();
    session = null;
  }
  const actions: DomMotionActions = {
    disposeDomMotionSurface: dispose,
    bootstrapDomMotion: async () => {
      const ctx = getContext();
      if (!includesLocalEffects) return false;
      let documents;
      try {
        documents = await loadLocalDomMotionCatalog();
      } catch (error) {
        ctx.logDiagnostic(
          error instanceof Error ? error.message : "Invalid DOM motion catalog",
          "error",
        );
        return false;
      }
      const firstDocument = documents[0];
      if (!firstDocument) return false;
      ctx.state.templates = documents.map((document) =>
        readEditorTemplateSource(createDomMotionTemplate(document)),
      );
      ctx.state.pack = { packId: "sniptale.dom-motion" };
      const requested = new URL(location.href).searchParams.get("scene");
      ctx.state.startupTemplateId = documents.some((d) => d.id === requested)
        ? requested
        : firstDocument.id;
      for (const template of ctx.state.templates)
        if (template.moduleId) ctx.state.loadedModules.add(template.moduleId);
      ctx.populateTemplates(ctx.state.templates);
      ctx.setPackStatus(
        ctx.deps.t("viewer.domMotion.loaded", "HTML motion scenes loaded"),
        "ready",
      );
      void ctx.selectInitialTemplateWhenReady();
      return true;
    },
    prepareDomMotionTemplate: async (template) => {
      const ctx = getContext();
      dispose();
      const document = readDomMotionTemplateDocument(template);
      if (!template || !document) return false;
      const surface = createDomMotionSurface(ctx.refs.stageFrame, document);
      const current = {
        source: template,
        generation: ctx.state.templateSelectionGeneration,
        templateId: template.id,
        surface,
        ready: false,
      };
      session = current;
      ctx.refs.previewCacheButton.disabled = true;
      ctx.refs.previewCacheButton.title = ctx.deps.t(
        "viewer.domMotion.liveOnly",
        "HTML scenes use live preview",
      );
      try {
        await surface.ready;
      } catch (error) {
        if (session !== current) return true;
        dispose();
        throw error;
      }
      if (
        session !== current ||
        ctx.state.currentTemplate !== template ||
        ctx.state.templateSelectionGeneration !== current.generation
      ) {
        if (session === current) dispose();
        else surface.dispose();
        return true;
      }
      surface.frame.title = ctx.deps.translateText(template.label, template.id);
      current.ready = true;
      if (template.moduleId) ctx.state.loadedModules.add(template.moduleId);
      ctx.state.rendererContractCoverageReady = true;
      ctx.state.rendererContractTemplateId = template.id;
      ctx.syncPlaybackButtons();
      await ctx.renderCurrentFrame();
      if (
        session !== current ||
        ctx.state.currentTemplate !== template ||
        ctx.state.templateSelectionGeneration !== current.generation
      )
        return true;
      ctx.updateExportAvailability();
      if (new URL(location.href).searchParams.get("autoplay") === "1")
        ctx.startPlayback();
      return true;
    },
    renderDomMotionFrame: async () => {
      const ctx = getContext();
      const base = ctx.state.currentTemplate;
      const template = ctx.getEffectiveTemplate(base);
      const current = session;
      if (
        !current?.ready ||
        !template ||
        current.source !== base ||
        current.generation !== ctx.state.templateSelectionGeneration ||
        !readDomMotionTemplateDocument(template) ||
        current.templateId !== template.id
      )
        return;
      const started = performance.now();
      const timeline = ctx.getEffectiveTimeline(template);
      current.surface.setTimeline(timeline, template.duration);
      const time = Math.max(
        0,
        Math.min(template.duration, Number(ctx.refs.timeSlider.value) || 0),
      );
      const active = template.layers
        .filter(
          (layer) =>
            layer.visible !== false &&
            template.clips.some(
              (clip) =>
                clip.layerId === layer.id &&
                clip.enabled !== false &&
                time >= clip.start &&
                time <= clip.start + clip.duration,
            ),
        )
        .map((layer) => layer.id);
      current.surface.setVisibleTargets(active);
      current.surface.render(time);
      ctx.refs.fastPreviewCanvas.hidden = true;
      ctx.refs.directPreviewCanvas.hidden = true;
      ctx.refs.canvas.style.opacity = "0";
      ctx.hidePlaybackVideoCacheSurface?.();
      ctx.refs.timeOutput.textContent = ctx.formatSeconds(time);
      if (ctx.refs.fullscreenTimeSlider) {
        ctx.refs.fullscreenTimeSlider.max = String(template.duration);
        ctx.refs.fullscreenTimeSlider.value = String(time);
      }
      if (ctx.refs.fullscreenTimeOutput)
        ctx.refs.fullscreenTimeOutput.textContent = ctx.formatSeconds(time);
      ctx.state.lastBindingReads = ctx.deps.normalizeBindingReads(
        current.surface.bindingReads,
      );
      ctx.mergeRendererContractReads(template.id, ctx.state.lastBindingReads);
      ctx.updateRenderStats(performance.now() - started, 1);
      ctx.refs.renderStats.dataset.status = "applied";
    },
    importDomMotionSource: async (value: unknown, select = true) => {
      const ctx = getContext();
      const document = parseDomMotionDocument(value);
      if (ctx.state.templates.some((t) => t.id === document.id))
        document.id = ctx.createUniqueTemplateId(document.id);
      const template = createDomMotionTemplate(document);
      ctx.state.templates = [
        ...ctx.state.templates,
        readEditorTemplateSource(template),
      ];
      if (template.moduleId) ctx.state.loadedModules.add(template.moduleId);
      ctx.populateTemplates(ctx.state.templates);
      if (select) await ctx.selectTemplate(template.id);
      return { ok: true, errors: [], templateId: template.id };
    },
    exportDomMotionSource: () => {
      const ctx = getContext();
      const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
      const embedded = readDomMotionTemplateDocument(template);
      if (!template || !embedded) return null;
      const payload = parseDomMotionDocument({
        ...embedded,
        id: template.id,
        duration: template.duration,
        timeline: ctx.getEffectiveTimeline(template),
      });
      const source = JSON.stringify(payload, null, 2);
      const url = URL.createObjectURL(
        new Blob([source], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${template.id}.sniptale-dom-motion.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return source;
    },
  };
  return actions;
}
