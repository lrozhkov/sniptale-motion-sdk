import type * as DomMotion from "../../src/sdk/dom-motion/index.js";

declare global {
  interface Window {
    MotionSDK: typeof DomMotion;
    surface: DomMotion.DomMotionSurface;
  }
}
