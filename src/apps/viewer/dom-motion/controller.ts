import {
  createDomMotionSurface,
  parseDomMotionDocument,
  type DomMotionSurface,
} from "../../../sdk/dom-motion/index.js";
import type { ViewerAppContext } from "../app/context.js";
import { includesLocalEffects } from "../app/build-flags.js";
import { createDomMotionTemplate, isDomMotionTemplate } from "./template.js";
import { loadLocalDomMotionCatalog } from "./catalog.js";

type Session = {
  templateId: string;
  surface: DomMotionSurface;
  ready: boolean;
};
export function installDomMotionOwner(ctx: ViewerAppContext): void {
  let session: Session | null = null;
  function dispose() {
    session?.surface.dispose();
    session = null;
  }
  ctx.disposeDomMotionSurface = dispose;
  ctx.bootstrapDomMotion = async () => {
    if (!includesLocalEffects) return false;
    let documents;
    try {
      documents = await loadLocalDomMotionCatalog();
    } catch (error) {
      ctx.logDiagnostic(String(error), "error");
      return false;
    }
    if (documents.length === 0) return false;
    ctx.state.templates = documents.map(createDomMotionTemplate);
    ctx.state.pack = { packId: "sniptale.dom-motion" };
    const requested = new URL(location.href).searchParams.get("scene");
    ctx.state.startupTemplateId = documents.some((d) => d.id === requested)
      ? requested
      : documents[0].id;
    for (const template of ctx.state.templates)
      ctx.state.loadedModules.add(template.moduleId);
    ctx.populateTemplates(ctx.state.templates);
    ctx.setPackStatus(
      ctx.deps.t("viewer.domMotion.loaded", "HTML motion scenes loaded"),
      "ready",
    );
    void ctx.selectInitialTemplateWhenReady();
    return true;
  };
  ctx.prepareDomMotionTemplate = async (template) => {
    dispose();
    if (!isDomMotionTemplate(template)) return false;
    const surface = createDomMotionSurface(
      ctx.refs.stageFrame,
      template.domMotion,
    );
    const current = { templateId: template.id, surface, ready: false };
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
    if (session !== current || ctx.state.currentTemplate?.id !== template.id) {
      surface.dispose();
      return true;
    }
    surface.frame.title = ctx.deps.translateText(template.label, template.id);
    current.ready = true;
    ctx.state.loadedModules.add(template.moduleId);
    ctx.state.rendererContractCoverageReady = true;
    ctx.state.rendererContractTemplateId = template.id;
    ctx.syncPlaybackButtons();
    await ctx.renderCurrentFrame();
    ctx.updateExportAvailability();
    if (new URL(location.href).searchParams.get("autoplay") === "1")
      ctx.startPlayback();
    return true;
  };
  ctx.renderDomMotionFrame = async () => {
    const base = ctx.state.currentTemplate;
    const override = base ? ctx.state.editorOverrides.get(base.id) : null;
    const template = base
      ? {
          ...base,
          ...override,
          duration: Number(override?.duration ?? base.duration),
        }
      : null;
    const current = session;
    if (
      !current?.ready ||
      !isDomMotionTemplate(template) ||
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
  };
  ctx.importDomMotionSource = async (value: unknown, select = true) => {
    const document = parseDomMotionDocument(value);
    if (ctx.state.templates.some((t) => t.id === document.id))
      document.id = ctx.createUniqueTemplateId(document.id);
    const template = createDomMotionTemplate(document);
    ctx.state.templates = [...ctx.state.templates, template];
    ctx.state.loadedModules.add(template.moduleId);
    ctx.populateTemplates(ctx.state.templates);
    if (select) await ctx.selectTemplate(template.id);
    return { ok: true, errors: [], templateId: template.id };
  };
  ctx.exportDomMotionSource = () => {
    const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
    if (!isDomMotionTemplate(template)) return null;
    const payload = parseDomMotionDocument({
      ...template.domMotion,
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
  };
}
