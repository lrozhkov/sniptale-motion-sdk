import { validateEffectV1Document } from "../../../sdk/effect-v1/index.js";
import { MessageKind } from "../../../sdk/protocol.js";
import {
  parseSandboxRenderFrameMessage,
  type SandboxRenderFrameMessage,
} from "./render-message-boundary.js";

export type SandboxRuntimeMessage =
  | { kind: "dispose" }
  | {
      document: Record<string, unknown>;
      kind: "loadEffectDocument";
      moduleId: string;
      requestId: string;
    }
  | {
      document: Record<string, unknown>;
      kind: "validateEffectDocument";
      requestId: string;
    }
  | SandboxRenderFrameMessage;

export function parseSandboxRuntimeMessage(
  value: unknown,
): SandboxRuntimeMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const message = value as Record<string, unknown>;
  if (message.kind === MessageKind.DISPOSE) {
    return { kind: "dispose" };
  }
  if (message.kind === MessageKind.LOAD_EFFECT_DOCUMENT) {
    const validation = validateEffectV1Document(message.document);
    if (
      typeof message.moduleId !== "string" ||
      typeof message.requestId !== "string" ||
      !validation.ok ||
      !validation.document
    ) {
      return null;
    }
    return {
      document: validation.document as unknown as Record<string, unknown>,
      kind: "loadEffectDocument",
      moduleId: message.moduleId,
      requestId: message.requestId,
    };
  }
  if (message.kind === MessageKind.VALIDATE_EFFECT_DOCUMENT) {
    if (
      !message.document ||
      typeof message.document !== "object" ||
      Array.isArray(message.document) ||
      typeof message.requestId !== "string"
    ) {
      return null;
    }
    return {
      document: message.document as Record<string, unknown>,
      kind: "validateEffectDocument",
      requestId: message.requestId,
    };
  }
  return message.kind === MessageKind.RENDER_FRAME
    ? parseSandboxRenderFrameMessage(message)
    : null;
}
