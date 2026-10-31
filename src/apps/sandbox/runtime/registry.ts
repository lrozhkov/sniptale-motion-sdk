import type { SandboxRenderer } from "./renderer-model.js";
export function createSandboxRegistry() {
  const effects = new Map<string, SandboxRenderer>();
  const compositions = new Map<string, SandboxRenderer>();
  const loadedModules = new Map<string, boolean>();
  const moduleRevisions = new Map<string, string>();

  function disposePrevious(id: string): void {
    const previous = effects.get(id) ?? compositions.get(id);
    if (typeof previous?.dispose === "function") {
      try {
        previous.dispose();
      } catch {
        /* Registration still replaces the old definition. */
      }
    }
    effects.delete(id);
    compositions.delete(id);
  }

  return {
    loadedModules,
    moduleRevisions,
    registerEffect(this: void, value: unknown) {
      const definition = readRenderer(
        value,
        "registerEffect expects an id and renderFrame(ctx).",
      );
      disposePrevious(definition.id);
      effects.set(definition.id, definition);
    },
    registerComposition(this: void, value: unknown) {
      const definition = readRenderer(
        value,
        "registerComposition expects an id and renderFrame(ctx).",
        "composition",
      );
      disposePrevious(definition.id);
      compositions.set(definition.id, { ...definition, kind: "composition" });
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
      for (const effect of [...effects.values(), ...compositions.values()]) {
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
      moduleRevisions.clear();
    },
  };
}

function readRenderer(
  input: unknown,
  message: string,
  kindOverride?: "composition",
): SandboxRenderer {
  if (!isRecord(input)) throw new Error(message);
  const value =
    kindOverride === undefined ? input : { ...input, kind: kindOverride };
  const id = value.id;
  const renderFrame = value.renderFrame;
  const dispose = value.dispose;
  const kind = value.kind;
  if (
    typeof id !== "string" ||
    !isCallable(renderFrame) ||
    (kind !== undefined && typeof kind !== "string")
  )
    throw new Error(message);
  return {
    id,
    ...(typeof kind === "string" ? { kind } : {}),
    ...(value.meta === undefined ? {} : { meta: value.meta }),
    ...(value.scenes === undefined ? {} : { scenes: value.scenes }),
    async renderFrame(context) {
      return await renderFrame.call(value, context);
    },
    ...(isCallable(dispose)
      ? {
          dispose() {
            // Registration teardown is best-effort, including asynchronous cleanup.
            const result: unknown = dispose.call(value);
            void Promise.resolve(result).catch(() => {});
          },
        }
      : {}),
  };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isCallable(
  value: unknown,
): value is (this: unknown, ...args: unknown[]) => unknown {
  return typeof value === "function";
}
