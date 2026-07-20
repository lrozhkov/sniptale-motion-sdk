import { TARGET_ENGINE_VERSION } from "../protocol.js";
import { validateAssetEntry } from "./assets.js";
import { isRecord, isSafeLocalPath, push } from "./common.js";
import { validateModuleEntry } from "./modules.js";

export function validateManifest(manifest, errors) {
  if (!isRecord(manifest)) {
    push(errors, "manifest", "Expected manifest object.");
    return;
  }
  for (const key of ["packId", "version", "engineVersion"]) {
    if (typeof manifest[key] !== "string" || manifest[key].trim() === "") {
      push(errors, `manifest.${key}`, "Expected non-empty string.");
    }
  }
  if (manifest.engineVersion !== TARGET_ENGINE_VERSION) {
    push(
      errors,
      "manifest.engineVersion",
      `Expected ${TARGET_ENGINE_VERSION}.`,
    );
  }
  if (manifest.templates !== undefined && !Array.isArray(manifest.templates)) {
    push(errors, "manifest.templates", "Expected a template path list.");
  } else if (Array.isArray(manifest.templates)) {
    manifest.templates.forEach((path, index) => {
      if (!isSafeLocalPath(path)) {
        push(
          errors,
          `manifest.templates.${index}`,
          "Expected safe local path.",
        );
      }
    });
  }
  if (!Array.isArray(manifest.modules) || manifest.modules.length === 0) {
    push(errors, "manifest.modules", "Expected effect module list.");
  } else {
    manifest.modules.forEach((item, index) =>
      validateModuleEntry(item, index, errors),
    );
  }
  if (Array.isArray(manifest.assets)) {
    manifest.assets.forEach((item, index) =>
      validateAssetEntry(item, index, errors),
    );
  }
}
