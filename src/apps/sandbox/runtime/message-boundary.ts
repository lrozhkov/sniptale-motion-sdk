import {
  validateEffectV1Document,
  type EffectV1Document,
} from "../../../sdk/effect-v1/index.js";
import { MessageKind } from "../../../sdk/protocol.js";
import {
  parseSandboxRenderFrameMessage,
  type SandboxRenderFrameMessage,
} from "./render-message-boundary.js";

export type SandboxRuntimeMessage =
  | { kind: "dispose" }
  | {
      document: EffectV1Document;
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
  if (!isRecord(value)) {
    return null;
  }
  const message = value;
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
      document: validation.document,
      kind: "loadEffectDocument",
      moduleId: message.moduleId,
      requestId: message.requestId,
    };
  }
  if (message.kind === MessageKind.VALIDATE_EFFECT_DOCUMENT) {
    if (!isRecord(message.document) || typeof message.requestId !== "string") {
      return null;
    }
    return {
      document: message.document,
      kind: "validateEffectDocument",
      requestId: message.requestId,
    };
  }
  return message.kind === MessageKind.RENDER_FRAME
    ? parseSandboxRenderFrameMessage(message)
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
