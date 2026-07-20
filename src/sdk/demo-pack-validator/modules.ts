import { validateEffectV1Document } from "../effect-v1/validation.js";
import { isRecord, isSafeLocalPath, push } from "./common.js";
import { readJson } from "./readers.js";

export function validateModuleEntry(item, index, errors) {
  if (!isRecord(item)) {
    push(errors, `manifest.modules.${index}`, "Expected module entry.");
    return;
  }
  if (typeof item.id !== "string" || item.id.trim() === "") {
    push(errors, `manifest.modules.${index}.id`, "Expected module id.");
  }
  if (Object.hasOwn(item, "path")) {
    push(
      errors,
      `manifest.modules.${index}.path`,
      "Executable module paths are forbidden; use a v1 document.",
    );
  }
  if (!isSafeLocalPath(item.document)) {
    push(
      errors,
      `manifest.modules.${index}.document`,
      "Expected a safe local Effect v1 document path.",
    );
  }
  if (item.runtimeCapabilities !== undefined) {
    push(
      errors,
      `manifest.modules.${index}.runtimeCapabilities`,
      "V1 documents derive runtime capabilities from the graph.",
    );
  }
}

export async function readModules(baseUrl, manifest, errors) {
  const modules = new Map();
  if (!Array.isArray(manifest.modules)) {
    return modules;
  }
  for (const entry of manifest.modules) {
    if (!isRecord(entry) || !isSafeLocalPath(entry.document)) continue;
    const document = await readJson(
      `${baseUrl}${entry.document}`,
      errors,
      entry.document,
    );
    if (!document) continue;
    const validation = validateEffectV1Document(document);
    if (!validation.ok || !validation.document) {
      for (const diagnostic of validation.diagnostics) {
        push(
          errors,
          `${entry.document}${diagnostic.path.slice(1)}`,
          `${diagnostic.code}: ${diagnostic.message}`,
        );
      }
      continue;
    }
    if (validation.document.id !== entry.id) {
      push(errors, `${entry.document}.id`, `Expected document id ${entry.id}.`);
      continue;
    }
    modules.set(entry.id, {
      document: validation.document,
      id: entry.id,
      path: entry.document,
    });
  }
  return modules;
}

export function validateModuleSources(modules, errors) {
  for (const module of modules.values()) {
    if (typeof module.source === "string") {
      push(errors, module.path, "Executable effect modules are forbidden.");
    }
  }
}
