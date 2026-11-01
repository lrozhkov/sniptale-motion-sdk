import { vi } from "vitest";

class FixtureCanvas {
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext(): null {
    return null;
  }
}
class FixtureBitmap {
  width = 1;
  height = 1;
  close(): void {}
}

/** Keep one constructor per native brand throughout a test. Restore globals in afterEach. */
export function createNativeCanvasFixture(port: object): OffscreenCanvas {
  vi.stubGlobal("OffscreenCanvas", FixtureCanvas);
  return Object.defineProperties(
    new OffscreenCanvas(1, 1),
    Object.getOwnPropertyDescriptors(port),
  );
}
export function createNativeBitmapFixture(port: object = {}): ImageBitmap {
  vi.stubGlobal("ImageBitmap", FixtureBitmap);
  return Object.defineProperties(
    new ImageBitmap(),
    Object.getOwnPropertyDescriptors(port),
  );
}

class FixturePort {
  addEventListener(): void {}
  postMessage(): void {}
  start(): void {}
  close(): void {}
}
export function createNativePortFixture(port: object = {}): MessagePort {
  vi.stubGlobal("MessagePort", FixturePort);
  return Object.defineProperties(
    new MessagePort(),
    Object.getOwnPropertyDescriptors(port),
  );
}

class FixtureDrawingContext {}

/** Allocate a native drawing brand; each consumer supplies the operations it observes. */
export function createNativeDrawingContextFixture(
  port: Pick<OffscreenCanvasRenderingContext2D, "canvas"> &
    Partial<OffscreenCanvasRenderingContext2D>,
): OffscreenCanvasRenderingContext2D {
  vi.stubGlobal("OffscreenCanvasRenderingContext2D", FixtureDrawingContext);
  return Object.defineProperties(
    new OffscreenCanvasRenderingContext2D(),
    Object.getOwnPropertyDescriptors(port),
  );
}
