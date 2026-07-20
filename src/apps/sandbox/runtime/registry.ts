export function createSandboxRegistry() {
  const effects = new Map<string, any>();
  const compositions = new Map<string, any>();
  const loadedModules = new Map<string, boolean>();

  return {
    loadedModules,
    registerEffect(definition: any) {
      if (
        !definition ||
        typeof definition.id !== "string" ||
        typeof definition.renderFrame !== "function"
      ) {
        throw new Error("registerEffect expects an id and renderFrame(ctx).");
      }
      effects.set(definition.id, definition);
    },
    registerComposition(definition: any) {
      if (
        !definition ||
        typeof definition.id !== "string" ||
        typeof definition.renderFrame !== "function"
      ) {
        throw new Error(
          "registerComposition expects an id and renderFrame(ctx).",
        );
      }
      compositions.set(definition.id, {
        ...definition,
        kind: "composition",
      });
    },
    getRenderer(effectId: string) {
      return effects.get(effectId) ?? compositions.get(effectId);
    },
    getEffectIds() {
      return Array.from(effects.keys());
    },
    getCompositionIds() {
      return Array.from(compositions.keys());
    },
    disposeAll() {
      for (const effect of effects.values()) {
        if (typeof effect.dispose === "function") {
          try {
            effect.dispose();
          } catch {
            // Sandbox teardown is best-effort; diagnostics are owned by frame requests.
          }
        }
      }
      effects.clear();
      compositions.clear();
      loadedModules.clear();
    },
  };
}
