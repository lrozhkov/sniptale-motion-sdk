import type { EffectsViewerTestApi } from "../test-api.js";

declare global {
  const __EFFECT_SDK_LOCAL_DEMO_PACK__: boolean;
  const __EFFECT_SDK_LOCAL_EFFECTS__: boolean;

  interface Window {
    effectsViewer: EffectsViewerTestApi;
    showOpenFilePicker?: any;
  }
}

export {};
