import type { createReactFacade } from "./react-facade.js";
import type { createThreeSandboxFacade } from "./three-facade.js";
import type { RuntimeRenderState } from "./runtime-model.js";

type ReactRuntime = ReturnType<typeof createReactFacade>;
type ThreeRuntime = ReturnType<typeof createThreeSandboxFacade>;

export function createOptionalRuntimeAccess(
  getState: () => RuntimeRenderState,
) {
  let reactRuntime: ReactRuntime | null = null;
  let reactRuntimePromise: Promise<ReactRuntime> | null = null;
  let threeRuntime: ThreeRuntime | null = null;
  let threeRuntimePromise: Promise<ThreeRuntime> | null = null;
  return {
    get React() {
      return requireOptionalRuntime(reactRuntime, "React", "react");
    },
    get THREE() {
      return requireOptionalRuntime(threeRuntime?.THREE, "THREE", "three");
    },
    get r3f() {
      return requireOptionalRuntime(threeRuntime?.r3f, "r3f", "r3f");
    },
    get three() {
      return requireOptionalRuntime(threeRuntime?.three, "three", "three");
    },
    async prepare(capabilities: unknown): Promise<void> {
      const values = Array.isArray(capabilities) ? capabilities : [];
      const needsR3f = values.includes("r3f");
      const pending: Promise<void>[] = [];
      if ((values.includes("react") || needsR3f) && !reactRuntime) {
        reactRuntimePromise ??= import("./react-facade.js").then((module) =>
          module.createReactFacade(),
        );
        pending.push(
          reactRuntimePromise.then((value) => {
            reactRuntime = value;
          }),
        );
      }
      if ((values.includes("three") || needsR3f) && !threeRuntime) {
        threeRuntimePromise ??= import("./three-facade.js").then((module) =>
          module.createThreeSandboxFacade({
            getBindingReadMode: () => getState().__bindingReadMode,
            getRenderViewport: () => getState().__renderViewport,
          }),
        );
        pending.push(
          threeRuntimePromise.then((value) => {
            threeRuntime = value;
          }),
        );
      }
      try {
        await Promise.all(pending);
      } catch (error) {
        if (!reactRuntime) reactRuntimePromise = null;
        if (!threeRuntime) threeRuntimePromise = null;
        throw error;
      }
    },
  };
}

function requireOptionalRuntime<Value>(
  value: Value | null | undefined,
  property: string,
  capability: string,
): Value {
  if (value) return value;
  throw new Error(
    `Runtime.${property} requires the ${capability} module capability.`,
  );
}
