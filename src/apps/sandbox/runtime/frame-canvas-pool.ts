type CanvasFactory = (width: number, height: number) => any;

type CanvasPoolEntry = {
  canvas: any;
  height: number;
  inUse: boolean;
  lastUsed: number;
  ownerKey: string;
  slot: number;
  width: number;
};

export type FrameCanvasLease = {
  createCanvas: CanvasFactory;
  release: () => void;
};

export function createFrameCanvasPool(
  createCanvas: CanvasFactory,
  maxEntries = 8,
) {
  const entries: CanvasPoolEntry[] = [];
  let clock = 0;

  function beginFrame(ownerKey: string): FrameCanvasLease {
    const leased: CanvasPoolEntry[] = [];
    let released = false;
    let slot = 0;

    return {
      createCanvas(width, height) {
        const normalizedWidth = normalizeDimension(width);
        const normalizedHeight = normalizeDimension(height);
        const currentSlot = slot;
        slot += 1;
        let entry = entries.find(
          (candidate) =>
            !candidate.inUse &&
            candidate.ownerKey === ownerKey &&
            candidate.slot === currentSlot &&
            candidate.width === normalizedWidth &&
            candidate.height === normalizedHeight,
        );
        if (entry) {
          resetCanvas(entry.canvas, normalizedWidth, normalizedHeight);
        } else {
          entry = {
            canvas: createCanvas(normalizedWidth, normalizedHeight),
            height: normalizedHeight,
            inUse: false,
            lastUsed: 0,
            ownerKey,
            slot: currentSlot,
            width: normalizedWidth,
          };
          retainEntry(entries, entry, Math.max(1, maxEntries));
        }
        entry.inUse = true;
        entry.lastUsed = ++clock;
        leased.push(entry);
        return entry.canvas;
      },
      release() {
        if (released) {
          return;
        }
        released = true;
        for (const entry of leased) {
          entry.inUse = false;
          entry.lastUsed = ++clock;
        }
      },
    };
  }

  return {
    beginFrame,
    close() {
      entries.length = 0;
    },
    size() {
      return entries.length;
    },
  };
}

function normalizeDimension(value: number): number {
  return Math.max(1, Math.round(Number(value) || 1));
}

function resetCanvas(canvas: any, width: number, height: number): void {
  if (canvas.width !== width || canvas.height !== height) {
    if (canvas.width !== width) {
      canvas.width = width;
    }
    if (canvas.height !== height) {
      canvas.height = height;
    }
    return;
  }
  const context = canvas.getContext?.("2d");
  if (typeof context?.reset === "function") {
    context.reset();
    return;
  }
  canvas.width = width;
}

function retainEntry(
  entries: CanvasPoolEntry[],
  entry: CanvasPoolEntry,
  maxEntries: number,
): void {
  if (entries.length < maxEntries) {
    entries.push(entry);
    return;
  }
  let evictionIndex = -1;
  for (let index = 0; index < entries.length; index += 1) {
    if (
      !entries[index].inUse &&
      (evictionIndex < 0 ||
        entries[index].lastUsed < entries[evictionIndex].lastUsed)
    ) {
      evictionIndex = index;
    }
  }
  if (evictionIndex >= 0) {
    entries.splice(evictionIndex, 1, entry);
  }
}
