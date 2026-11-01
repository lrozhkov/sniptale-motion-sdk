import { describe, expect, it, vi } from "vitest";
import { createLazyMp4ExportActions } from "../src/apps/viewer/video-export/lazy-actions";
import type { Mp4ExportActions } from "../src/apps/viewer/video-export/actions";

function runtime() {
  return {
    localizeMp4ExportDialog:
      vi.fn<Mp4ExportActions["localizeMp4ExportDialog"]>(),
    openMp4ExportDialog: vi.fn<() => Promise<void>>(async () => {}),
    closeMp4ExportDialog: vi.fn<Mp4ExportActions["closeMp4ExportDialog"]>(),
    updateMp4ExportSize: vi.fn<() => Promise<void>>(async () => {}),
    updateMp4ExportCustomSize: vi.fn<() => Promise<void>>(async () => {}),
    startMp4Export: vi.fn<() => Promise<void>>(async () => {}),
  } satisfies Mp4ExportActions;
}

describe("lazy MP4 actions", () => {
  it("loads once on demand and preserves action arguments and Promise completion", async () => {
    const target = runtime();
    const load = vi.fn<Parameters<typeof createLazyMp4ExportActions>[0]>(
      async () => target,
    );
    const report = vi.fn<Parameters<typeof createLazyMp4ExportActions>[1]>();
    const actions = createLazyMp4ExportActions(load, report, () => "template");
    actions.localizeMp4ExportDialog();
    expect(load).not.toHaveBeenCalled();
    await Promise.all([
      actions.openMp4ExportDialog(),
      actions.updateMp4ExportSize(),
      actions.updateMp4ExportCustomSize(),
    ]);
    expect(load).toHaveBeenCalledOnce();
    expect(target.openMp4ExportDialog).toHaveBeenCalledOnce();
    expect(target.updateMp4ExportSize).toHaveBeenCalledOnce();
    expect(target.updateMp4ExportCustomSize).toHaveBeenCalledOnce();
    actions.localizeMp4ExportDialog();
    expect(target.localizeMp4ExportDialog).toHaveBeenCalledOnce();
    const event = new Event("submit", { cancelable: true });
    const start = actions.startMp4Export(event);
    expect(event.defaultPrevented).toBe(true);
    await start;
    expect(target.startMp4Export).toHaveBeenCalledWith();
    actions.closeMp4ExportDialog();
    expect(target.closeMp4ExportDialog).toHaveBeenCalledOnce();
    expect(report).not.toHaveBeenCalled();
  });

  it("reports a load failure and retries on the next action", async () => {
    const target = runtime();
    const failure = new Error("offline chunk");
    const load = vi
      .fn<() => Promise<Mp4ExportActions>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(target);
    const report = vi.fn<Parameters<typeof createLazyMp4ExportActions>[1]>();
    const actions = createLazyMp4ExportActions(load, report, () => "template");
    await expect(actions.openMp4ExportDialog()).resolves.toBeUndefined();
    expect(report).toHaveBeenCalledWith(failure);
    await actions.openMp4ExportDialog();
    expect(load).toHaveBeenCalledTimes(2);
    expect(target.openMp4ExportDialog).toHaveBeenCalledOnce();
  });

  it("cancels queued opening and starting when the dialog is closed during loading", async () => {
    const pending = Promise.withResolvers<Mp4ExportActions>();
    const target = runtime();
    const report = vi.fn<Parameters<typeof createLazyMp4ExportActions>[1]>();
    const actions = createLazyMp4ExportActions(
      () => pending.promise,
      report,
      () => "template",
    );
    const opening = actions.openMp4ExportDialog();
    const starting = actions.startMp4Export();
    actions.closeMp4ExportDialog();
    pending.resolve(target);
    await Promise.all([opening, starting]);
    expect(target.openMp4ExportDialog).not.toHaveBeenCalled();
    expect(target.startMp4Export).not.toHaveBeenCalled();
    await actions.openMp4ExportDialog();
    expect(target.openMp4ExportDialog).toHaveBeenCalledOnce();
    expect(report).not.toHaveBeenCalled();
  });

  it("does not replay actions for a replaced template or report canceled failures", async () => {
    const pending = Promise.withResolvers<Mp4ExportActions>();
    const target = runtime();
    let template = { id: "same-id" };
    const report = vi.fn<Parameters<typeof createLazyMp4ExportActions>[1]>();
    const actions = createLazyMp4ExportActions(
      () => pending.promise,
      report,
      () => template,
    );
    const opening = actions.openMp4ExportDialog();
    template = { id: "same-id" };
    pending.resolve(target);
    await opening;
    expect(target.openMp4ExportDialog).not.toHaveBeenCalled();
    const failing = Promise.withResolvers<Mp4ExportActions>();
    const canceled = createLazyMp4ExportActions(
      () => failing.promise,
      report,
      () => template,
    );
    const attempt = canceled.openMp4ExportDialog();
    canceled.closeMp4ExportDialog();
    failing.reject(new Error("canceled download"));
    await attempt;
    expect(report).not.toHaveBeenCalled();
  });

  it("handles rejected runtime actions without discarding a successfully loaded runtime", async () => {
    const target = runtime();
    const failure = new Error("codec failed");
    target.updateMp4ExportSize.mockRejectedValueOnce(failure);
    const load = vi.fn<Parameters<typeof createLazyMp4ExportActions>[0]>(
      async () => target,
    );
    const report = vi.fn<Parameters<typeof createLazyMp4ExportActions>[1]>();
    const actions = createLazyMp4ExportActions(load, report, () => "template");
    await actions.updateMp4ExportSize();
    await actions.updateMp4ExportSize();
    expect(report).toHaveBeenCalledExactlyOnceWith(failure);
    expect(load).toHaveBeenCalledOnce();
  });
});
