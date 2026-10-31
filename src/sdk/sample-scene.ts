type SampleSceneContext = Pick<
  CanvasRenderingContext2D,
  | "createLinearGradient"
  | "fillStyle"
  | "fillRect"
  | "save"
  | "restore"
  | "strokeStyle"
  | "lineWidth"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "stroke"
>;

type TransitionFrameContext = SampleSceneContext &
  Pick<
    CanvasRenderingContext2D,
    "globalAlpha" | "fill" | "arcTo" | "closePath"
  >;

type SampleSceneParams = {
  height: number;
  width: number;
  phase?: string;
  progress?: number;
};

export function drawSampleScene(
  context: SampleSceneContext,
  params: SampleSceneParams,
): void {
  const { height, phase = "base", width } = params;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, phase === "next" ? "#edf0ed" : "#080b0c");
  gradient.addColorStop(1, phase === "next" ? "#ffffff" : "#121719");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  if (phase !== "blank") {
    drawGrid(
      context,
      width,
      height,
      phase === "next" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.04)",
    );
  }
}

export async function createInputFrames(
  width: number,
  height: number,
  progress: number,
) {
  const previousCanvas = new OffscreenCanvas(width, height);
  const nextCanvas = new OffscreenCanvas(width, height);
  const previousContext = previousCanvas.getContext("2d");
  const nextContext = nextCanvas.getContext("2d");
  if (!previousContext || !nextContext) {
    throw new Error("Canvas 2D context is unavailable.");
  }
  drawSampleScene(previousContext, {
    height,
    phase: "previous",
    progress,
    width,
  });
  drawSampleScene(nextContext, {
    height,
    phase: "next",
    progress,
    width,
  });
  drawAbstractTransitionFrame(
    previousContext,
    width,
    height,
    progress,
    "previous",
  );
  drawAbstractTransitionFrame(nextContext, width, height, progress, "next");
  const next = await createImageBitmap(nextCanvas);
  try {
    return { next, previous: await createImageBitmap(previousCanvas) };
  } catch (error) {
    next.close();
    throw error;
  }
}

function drawGrid(
  context: SampleSceneContext,
  width: number,
  height: number,
  color: string,
): void {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 80) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += 80) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.restore();
}

function drawAbstractTransitionFrame(
  context: TransitionFrameContext,
  width: number,
  height: number,
  progress: number,
  phase: "previous" | "next",
): void {
  const cx = width * (phase === "next" ? 0.36 : 0.56);
  const cy = height * 0.5;
  const size = Math.min(width, height) * (phase === "next" ? 0.22 : 0.18);
  context.save();
  context.globalAlpha = phase === "next" ? 0.9 : 0.42 + progress * 0.28;
  context.fillStyle = phase === "next" ? "#f0f0ec" : "#ff8518";
  roundRect(context, cx - size / 2, cy - size / 2, size, size, size * 0.16);
  context.fill();
  context.strokeStyle =
    phase === "next" ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.18)";
  context.lineWidth = 3;
  context.stroke();
  context.globalAlpha *= 0.8;
  context.fillStyle = phase === "next" ? "#1d2328" : "#ffa13f";
  for (let index = 0; index < 3; index += 1) {
    context.fillRect(
      cx + size * 0.75,
      cy - size * 0.32 + index * size * 0.28,
      size * 0.9,
      size * 0.08,
    );
  }
  context.restore();
}

function roundRect(
  context: TransitionFrameContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
