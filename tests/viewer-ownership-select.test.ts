import { describe, expect, it, vi } from "vitest";
import { applyOwnershipSelectChange } from "../src/apps/viewer/inspector/ownership-select.js";

describe("ownership select change lifecycle", () => {
  it("waits for an asynchronous ownership edit to finish", async () => {
    const edited = Promise.withResolvers<void>();
    const onError = vi.fn<() => void>();
    let finished = false;
    const onChange = vi.fn<(value: string) => Promise<void>>(
      () => edited.promise,
    );
    const pending = applyOwnershipSelectChange(
      onChange,
      "phase-1",
      onError,
    ).then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    expect(onChange).toHaveBeenCalledWith("phase-1");
    edited.resolve();
    await pending;
    expect(finished).toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "reports failed changes without losing a rejection (async=%s)",
    async (async) => {
      const onError = vi.fn<() => void>();
      const error = new Error("Ownership failed.");
      const onChange = async
        ? () => Promise.reject(error)
        : () => {
            throw error;
          };
      await applyOwnershipSelectChange(onChange, "phase-1", onError);
      expect(onError).toHaveBeenCalledOnce();
    },
  );
});
