import type { DemoPackIssue } from "./common.js";
import { TARGET_ENGINE_VERSION } from "../protocol.js";
import { validateAssetEntry } from "./assets.js";
import { isRecord, isSafeLocalPath, push } from "./common.js";
import { validateModuleEntry } from "./modules.js";

export type DemoPackMetadata = Record<string, unknown> & {
  packId: string;
  version: string;
  engineVersion: string;
};

export function validateManifest(
  manifest: unknown,
  errors: DemoPackIssue[],
): manifest is DemoPackMetadata {
  const previousErrorCount = errors.length;
  if (!isRecord(manifest)) {
    push(errors, "manifest", "Expected manifest object.");
    return false;
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
  if (manifest.assets !== undefined && !Array.isArray(manifest.assets)) {
    push(errors, "manifest.assets", "Expected asset entry list.");
  } else if (Array.isArray(manifest.assets)) {
    manifest.assets.forEach((item, index) =>
      validateAssetEntry(item, index, errors),
    );
  }
  return errors.length === previousErrorCount;
}
