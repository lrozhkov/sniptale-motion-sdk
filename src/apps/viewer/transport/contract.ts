import type { SandboxRequest } from "./state.js";
import type { ViewerSandboxMessage } from "./message-boundary.js";
export type SandboxRenderResponse = Extract<
  ViewerSandboxMessage,
  { kind: "renderFrameResult" }
>;
export type SandboxLoadResponse = Extract<
  ViewerSandboxMessage,
  { kind: "loadEffectDocumentResult" }
>;
export type SandboxValidationResponse = Extract<
  ViewerSandboxMessage,
  { kind: "validateEffectDocumentResult" }
>;
export type SandboxResponse =
  | SandboxRenderResponse
  | SandboxLoadResponse
  | SandboxValidationResponse;
export interface SandboxRequester {
  (
    message: SandboxRequest & { kind: "renderFrame" },
    timeoutMs: number,
    transfer?: Transferable[],
  ): Promise<SandboxRenderResponse>;
  (
    message: SandboxRequest & { kind: "loadEffectDocument" },
    timeoutMs: number,
    transfer?: Transferable[],
  ): Promise<SandboxLoadResponse>;
  (
    message: SandboxRequest & { kind: "validateEffectDocument" },
    timeoutMs: number,
    transfer?: Transferable[],
  ): Promise<SandboxValidationResponse>;
  (
    message: SandboxRequest,
    timeoutMs: number,
    transfer?: Transferable[],
  ): Promise<SandboxResponse>;
}
export interface TransportRuntimeActions {
  requestSandbox: SandboxRequester;
  markSandboxRuntimeReady(): void;
  markSandboxRenderHealthy(templateId: string): void;
}
export interface TransportControllerActions {
  handleSandboxMessage(value: unknown): void;
  ensureModuleLoaded(moduleId: string | undefined): Promise<boolean>;
  createUniqueModuleId(baseId: string): string;
  createSandboxUrl(): string;
}
