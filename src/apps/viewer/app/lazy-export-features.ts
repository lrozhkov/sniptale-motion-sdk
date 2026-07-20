import type { ViewerAppContext } from "./context.js";

function installLazyExportFeaturesOwner(ctx: ViewerAppContext): void {
  let videoExportPromise: Promise<void> | null = null;
  const loadVideoExport = () =>
    (videoExportPromise ??= import("../video-export/controller.js").then(
      (module) => module.installVideoExportControllerOwner(ctx),
    ));

  ctx.localizeMp4ExportDialog = () => {};
  ctx.openMp4ExportDialog = async (...args: any[]) => {
    await loadVideoExport();
    return ctx.openMp4ExportDialog(...args);
  };
  ctx.closeMp4ExportDialog = (...args: any[]) => {
    if (videoExportPromise) {
      void videoExportPromise.then(() => ctx.closeMp4ExportDialog(...args));
    }
  };
  ctx.updateMp4ExportSize = async (...args: any[]) => {
    await loadVideoExport();
    return ctx.updateMp4ExportSize(...args);
  };
  ctx.updateMp4ExportCustomSize = async (...args: any[]) => {
    await loadVideoExport();
    return ctx.updateMp4ExportCustomSize(...args);
  };
  ctx.startMp4Export = async (event?: Event) => {
    event?.preventDefault();
    await loadVideoExport();
    return ctx.startMp4Export();
  };
}

export { installLazyExportFeaturesOwner };
