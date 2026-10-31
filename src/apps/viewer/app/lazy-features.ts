import type { ViewerAppContext } from "./context.js";
import { installLazyGraphEditorOwner } from "../graph-editor/lazy.js";

export function installLazyViewerFeatures(ctx: ViewerAppContext): void {
  installLazyGraphEditorOwner(ctx);
}
