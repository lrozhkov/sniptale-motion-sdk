type WorkerRuntimeScope = {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
};

/** The worker entry uses these two browser capabilities and keeps their receiver. */
export function readWorkerRuntimeScope(value: unknown): WorkerRuntimeScope {
  if (!isWorkerRuntimeScope(value))
    throw new Error("Worker messaging is unavailable.");
  return value;
}
function isWorkerRuntimeScope(value: unknown): value is WorkerRuntimeScope {
  return (
    value !== null &&
    typeof value === "object" &&
    "postMessage" in value &&
    typeof value.postMessage === "function" &&
    "addEventListener" in value &&
    typeof value.addEventListener === "function"
  );
}
