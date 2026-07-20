export const SANDBOX_RUNTIME_CAPABILITIES = ["react", "three", "r3f"] as const;

export type SandboxRuntimeCapability =
  (typeof SANDBOX_RUNTIME_CAPABILITIES)[number];

export function isSandboxRuntimeCapability(
  value: unknown,
): value is SandboxRuntimeCapability {
  return SANDBOX_RUNTIME_CAPABILITIES.includes(
    value as SandboxRuntimeCapability,
  );
}
