export async function loadEmptyStartupPack() {
  return {
    assets: new Map(),
    errors: [],
    modules: new Map(),
    pack: null,
    templates: [],
  };
}

export function drawEmptyPreview(context, params) {
  context.fillStyle = "#050607";
  context.fillRect(0, 0, params.width, params.height);
}

export async function createEmptyInputFrames(width, height) {
  const previousCanvas = new OffscreenCanvas(width, height);
  const nextCanvas = new OffscreenCanvas(width, height);
  fillInputSurface(previousCanvas, "#101216");
  fillInputSurface(nextCanvas, "#f4f5f4");
  return {
    next: await createImageBitmap(nextCanvas),
    previous: await createImageBitmap(previousCanvas),
  };
}

function fillInputSurface(canvas, color) {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Transition preview surface is unavailable.");
  }
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
}
