import { describe, expect, it, vi } from "vitest";
import { closeSmokeResources } from "./resources.ts";

describe("smoke runtime resource ownership", () => {
  it.each(["browser", "viewer", "sandbox"])(
    "closes all resources when %s shutdown fails",
    async (failed) => {
      const close = vi.fn<() => Promise<void>>(async () => {
        if (failed === "browser") throw new Error("browser shutdown");
      });
      const viewer = vi.fn<() => Promise<void>>(async () => {
        if (failed === "viewer") throw new Error("viewer shutdown");
      });
      const sandbox = vi.fn<() => Promise<void>>(async () => {
        if (failed === "sandbox") throw new Error("sandbox shutdown");
      });
      await expect(
        closeSmokeResources({ close }, [
          { [Symbol.asyncDispose]: viewer },
          { [Symbol.asyncDispose]: sandbox },
        ]),
      ).rejects.toThrow(AggregateError);
      expect(close).toHaveBeenCalledOnce();
      expect(viewer).toHaveBeenCalledOnce();
      expect(sandbox).toHaveBeenCalledOnce();
    },
  );
  it("observes a synchronous failure and supports partially initialized runtimes", async () => {
    const close = vi.fn<() => Promise<void>>(() => {
      throw new Error("synchronous shutdown");
    });
    const dispose = vi.fn<() => Promise<void>>(async () => {});
    await expect(
      closeSmokeResources({ close }, [
        null,
        { [Symbol.asyncDispose]: dispose },
      ]),
    ).rejects.toThrow(AggregateError);
    expect(dispose).toHaveBeenCalledOnce();
    await expect(closeSmokeResources(null, [null])).resolves.toBeUndefined();
  });
});
