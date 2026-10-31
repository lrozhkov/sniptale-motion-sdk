import type { ViewerAppContext } from "./context.js";
import type { Mp4ExportActions } from "../video-export/actions.js";
import { createLazyMp4ExportActions } from "../video-export/lazy-actions.js";

export function createLazyExportFeatures(
  getContext: () => ViewerAppContext,
): Mp4ExportActions {
  return createLazyMp4ExportActions(
    async () => {
      const module = await import("../video-export/controller.js");
      return module.createVideoExportActions(getContext());
    },
    (error) => {
      const ctx = getContext();
      const status = ctx.deps.t("viewer.mp4Export.failed", "MP4 export failed");
      ctx.state.mp4Export.status = status;
      ctx.refs.mp4ExportStatus.textContent = status;
      ctx.refs.timelineSaveStatus.textContent = status;
      ctx.logDiagnostic(
        `MP4 export failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    },
    () => getContext().state.currentTemplate,
  );
}
