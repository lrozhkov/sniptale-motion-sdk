import { responseObject } from "../tooling/test/fixtures/response.js";
import { describe, expect, it } from "vitest";
import { parseSandboxRuntimeMessage } from "../src/apps/sandbox/runtime/message-boundary.js";
import {
  loadSandboxEffectDocument,
  validateSandboxEffectDocument,
} from "../src/apps/sandbox/runtime/effect-v1/document-session.js";
import { createSandboxRegistry } from "../src/apps/sandbox/runtime/registry.js";
import { createSandboxRuntimeFacade } from "../src/apps/sandbox/runtime/runtime-facade.js";
import { createControlPresentationDocument } from "../tooling/test/fixtures/control-presentation.js";
import { requiredEntry } from "./helpers/required-entry.js";

describe("retained Effect v1 replay", () => {
  it("loads an immutable legacy snapshot while authoring validation rejects its duplicate icon", async () => {
    const document = createControlPresentationDocument();
    requiredEntry(document.controlGroups ?? [], 0).icon = "palette";
    const source = JSON.stringify(document);
    const registry = createSandboxRegistry();
    const runtime = createSandboxRuntimeFacade(registry);
    const messages: unknown[] = [];
    const post = (message: unknown) => {
      messages.push(message);
    };
    const message = parseSandboxRuntimeMessage({
      kind: "loadEffectDocument",
      document,
      moduleId: "retained",
      requestId: "load:1",
    });
    if (!message || message.kind !== "loadEffectDocument")
      throw new Error("Retained document was rejected by runtime admission.");
    await loadSandboxEffectDocument(post, registry, runtime, message);
    expect(messages).toContainEqual(
      expect.objectContaining({ kind: "loadEffectDocumentResult", ok: true }),
    );
    expect(registry.getCompositionIds()).toContain(document.id);
    validateSandboxEffectDocument(post, runtime, {
      kind: "validateEffectDocument",
      document: { ...document },
      requestId: "validate:1",
    });
    const rejected = responseObject(requiredEntry(messages, 1));
    expect(rejected.kind).toBe("validateEffectDocumentResult");
    expect(rejected.ok).toBe(false);
    expect(rejected.error).toEqual(
      expect.stringContaining("CONTROL_GROUP_ICON_DUPLICATE"),
    );
    expect(JSON.stringify(document)).toBe(source);
  });

  it("rejects executable payloads even when replay also contains a decorative conflict", () => {
    const document = createControlPresentationDocument();
    requiredEntry(document.controlGroups ?? [], 0).icon = "palette";
    expect(
      parseSandboxRuntimeMessage({
        kind: "loadEffectDocument",
        document: { ...document, source: "evil()" },
        moduleId: "retained",
        requestId: "load:2",
      }),
    ).toBeNull();
  });
});
