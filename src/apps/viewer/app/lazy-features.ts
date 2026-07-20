import type { ViewerAppContext } from "./context.js";
import { installLazyGraphEditorOwner } from "../graph-editor/lazy.js";
import { installLazyExportFeaturesOwner } from "./lazy-export-features.js";

export function installLazyViewerFeatures(ctx: ViewerAppContext): void {
  installLazyGraphEditorOwner(ctx);
  installLazyExportFeaturesOwner(ctx);
}
