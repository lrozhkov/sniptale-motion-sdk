export type CacheBitmap = ImageBitmap;

export type RetainedPreviewFrame = {
  borrow?: () => CacheBitmap;
  bytes: number;
  height: number;
  prime?: () => void;
  rawBytes: number;
  release: () => void;
  restore: () => Promise<CacheBitmap>;
  storage: "bitmap" | "png";
  width: number;
};

export type PreviewFrameRetentionOptions = {
  preferReusableBitmap?: boolean;
};

const CACHE_CODEC_OPERATION_TIMEOUT_MS = 2_000;

export function createPreviewFrameRetainer(): (
  bitmap: CacheBitmap,
  options?: PreviewFrameRetentionOptions,
) => Promise<RetainedPreviewFrame> {
  let encoderCanvas: OffscreenCanvas | null = null;
  let encoderContext: OffscreenCanvasRenderingContext2D | null = null;
  return async (
    bitmap: CacheBitmap,
    options: PreviewFrameRetentionOptions = {},
  ) => {
    const width = Math.max(0, Math.round(Number(bitmap.width) || 0));
    const height = Math.max(0, Math.round(Number(bitmap.height) || 0));
    const rawBytes = width * height * 4;
    if (rawBytes <= 0) {
      throw new Error("Expected a non-empty preview frame.");
    }
    if (
      options.preferReusableBitmap === true &&
      typeof createImageBitmap === "function"
    ) {
      return retainReusableBitmap(bitmap, width, height, rawBytes);
    }
    if (
      typeof OffscreenCanvas !== "undefined" &&
      typeof createImageBitmap === "function"
    ) {
      try {
        if (!encoderCanvas) {
          encoderCanvas = new OffscreenCanvas(width, height);
          encoderContext = encoderCanvas.getContext("2d", {
            alpha: true,
            // Cache preparation repeatedly reads the canvas back for lossless
            // encoding. Prefer a CPU-backed surface so this background task
            // does not monopolize an integrated GPU.
            willReadFrequently: true,
          });
        }
        if (!encoderContext) {
          throw new Error("Preview frame encoder context is unavailable.");
        }
        if (encoderCanvas.width !== width) {
          encoderCanvas.width = width;
        }
        if (encoderCanvas.height !== height) {
          encoderCanvas.height = height;
        }
        encoderContext.clearRect(0, 0, width, height);
        encoderContext.drawImage(bitmap, 0, 0);
        const blob = await waitForCacheCodecOperation(
          encoderCanvas.convertToBlob({ type: "image/png" }),
        );
        if (blob.size <= 0) {
          throw new Error("Preview frame encoder returned an empty image.");
        }
        return {
          bytes: blob.size,
          height,
          rawBytes,
          ...createPrimedFrameRestore(() =>
            waitForCacheBitmap(createImageBitmap(blob)),
          ),
          storage: "png" as const,
          width,
        };
      } catch {
        // Some embedded browsers expose OffscreenCanvas without a working
        // encoder. Do not reuse a surface whose GPU readback may still be
        // unresolved; fall back to the bounded bitmap cache for this frame.
        encoderCanvas = null;
        encoderContext = null;
      }
    }
    const retained = await waitForCacheBitmap(createImageBitmap(bitmap));
    return {
      bytes: rawBytes,
      height,
      rawBytes,
      ...createPrimedFrameRestore(
        () => waitForCacheBitmap(createImageBitmap(retained)),
        () => retained.close?.(),
      ),
      storage: "bitmap" as const,
      width,
    };
  };
}

async function retainReusableBitmap(
  bitmap: CacheBitmap,
  width: number,
  height: number,
  rawBytes: number,
): Promise<RetainedPreviewFrame> {
  const retained = await waitForCacheBitmap(createImageBitmap(bitmap));
  return {
    borrow: () => retained,
    bytes: rawBytes,
    height,
    rawBytes,
    release: () => retained.close?.(),
    restore: () => waitForCacheBitmap(createImageBitmap(retained)),
    storage: "bitmap",
    width,
  };
}

function waitForCacheBitmap(
  operation: Promise<ImageBitmap>,
): Promise<ImageBitmap> {
  return waitForCacheCodecOperation(operation, (bitmap) => bitmap.close());
}

function waitForCacheCodecOperation<T>(
  operation: Promise<T>,
  discardLate?: (value: T) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error("Preview cache codec did not respond."));
    }, CACHE_CODEC_OPERATION_TIMEOUT_MS);
    void operation.then(
      (value) => {
        if (settled) {
          discardLate?.(value);
          return;
        }
        settled = true;
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (settled) {
          return;
        }
        settled = true;
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function createPrimedFrameRestore(
  decode: () => Promise<CacheBitmap>,
  releaseSource: () => void = () => {},
): Pick<RetainedPreviewFrame, "prime" | "release" | "restore"> {
  let primed: Promise<CacheBitmap> | null = null;
  let released = false;
  const startDecode = () => {
    const pending = decode();
    void pending.catch(() => {
      if (primed === pending) {
        primed = null;
      }
    });
    return pending;
  };
  return {
    prime() {
      if (!released && !primed) {
        primed = startDecode();
      }
    },
    release() {
      released = true;
      releaseSource();
      const pending = primed;
      primed = null;
      if (pending) {
        void pending.then(
          (bitmap) => bitmap.close?.(),
          () => {},
        );
      }
    },
    async restore() {
      if (released) {
        throw new Error("Preview frame has been released.");
      }
      const pending = primed ?? startDecode();
      if (primed === pending) {
        primed = null;
      }
      return await pending;
    },
  };
}
