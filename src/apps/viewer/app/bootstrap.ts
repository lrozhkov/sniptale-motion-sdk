import { installStudioLiveReload } from "../studio/live-reload.js";
import { createViewerContext } from "./create-context.js";
import { wireViewerStartup } from "./startup.js";
import { installViewerTestApi } from "../test-api.js";
import { includesLocalDemoPack } from "./build-flags.js";
import { installViewerStudioOwner } from "../studio/controller.js";
import { wireAppTablists } from "./tablist.js";
import { initializeEditorDraftStorage } from "../editor/draft.js";
export function startViewerApp(): void {
  const ctx = createViewerContext();

  initializeEditorDraftStorage();
  installViewerStudioOwner(ctx);
  wireAppTablists(ctx);
  wireViewerStartup(ctx);
  installStudioLiveReload(ctx);
  if (includesLocalDemoPack) {
    installViewerTestApi(ctx);
  }
}
