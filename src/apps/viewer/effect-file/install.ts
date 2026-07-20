import type { ViewerAppContext } from "../app/context.js";
import { installEffectFileImportExportOwner } from "./import-export.js";
import { installEffectFileJsonBindingOwner } from "./json-binding.js";
import { installLocalEffectStartupOwner } from "./local-startup.js";
import { installEffectFileServiceOwner } from "./service.js";

export function installEffectFileOwners(ctx: ViewerAppContext): void {
  installEffectFileServiceOwner(ctx);
  installEffectFileImportExportOwner(ctx);
  installEffectFileJsonBindingOwner(ctx);
  installLocalEffectStartupOwner(ctx);
}
