export {};

declare global {
  interface Window {
    __effectV1SmokePreview?: Uint8ClampedArray;
    __motionPointerProbe?: { count(): number; restore(): void };
  }
}
