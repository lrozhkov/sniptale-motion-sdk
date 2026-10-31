import { describe, expect, it, vi } from "vitest";
import {
  createStudioReloadCoordinator,
  type ReloadTarget,
  type StudioSource,
} from "../src/apps/viewer/studio/reload-coordinator";
import type { StudioEffectSelection } from "../src/shared/studio/revision-contract";

function source(
  version: string,
  revisionId: string | null = null,
): StudioSource {
  return {
    default: true,
    source: version,
    sourceName: "sample.sniptale-effect.json",
    studio: { effectId: "sample", fingerprint: version.repeat(64), revisionId },
  };
}
function fixture() {
  let selection: StudioEffectSelection = source("a").studio;
  const state = {
    identity: {},
    editor: "unchanged",
    dirty: false,
    blocked: false,
  };
  const applied: string[] = [];
  const notice = vi.fn();
  const prepare = vi.fn(async (entry: StudioSource) => entry.source);
  const target = (): ReloadTarget => ({
    identity: state.identity,
    effectId: "sample",
    selection,
    editor: () => ({ fingerprint: state.editor, dirty: state.dirty }),
    blocked: () => state.blocked,
  });
  const apply = vi.fn(
    async (
      _prepared: string,
      entry: StudioSource,
      _target: ReloadTarget,
      canCommit: () => boolean,
    ) => {
      if (!canCommit()) return false;
      applied.push(entry.source);
      selection = entry.studio;
      state.identity = {};
      state.dirty = false;
      return true;
    },
  );
  const coordinator = createStudioReloadCoordinator({
    target,
    prepare,
    apply,
    notice,
  });
  return { state, applied, prepare, apply, notice, coordinator };
}

describe("Studio source reload authority", () => {
  it("applies a new valid source and skips an unchanged version", async () => {
    const { coordinator, applied, prepare } = fixture();
    await coordinator.accept({ effects: [source("b")], errors: [] });
    await coordinator.accept({ effects: [source("b")], errors: [] });
    expect(applied).toEqual(["b"]);
    expect(prepare).toHaveBeenCalledOnce();
  });

  it("retains the last source when the file is invalid, deleted, or the connection is unavailable", async () => {
    const { coordinator, applied, notice } = fixture();
    await coordinator.accept({ effects: [], errors: ["invalid document"] });
    expect(notice).toHaveBeenLastCalledWith("unavailable");
    coordinator.unavailable();
    await coordinator.sync();
    expect(applied).toEqual([]);
    await coordinator.accept({ effects: [source("c")], errors: [] });
    expect(applied).toEqual(["c"]);
  });

  it("requires explicit permission for local edits or a different selected revision", async () => {
    const { coordinator, state, prepare, applied } = fixture();
    state.dirty = true;
    await coordinator.accept({ effects: [source("b")], errors: [] });
    expect(prepare).not.toHaveBeenCalled();
    await coordinator.permitCurrent();
    expect(applied).toEqual(["b"]);
    await coordinator.accept({
      effects: [source("c", "12345678-1234-4123-8123-123456789abc")],
      errors: [],
    });
    expect(applied).toEqual(["b"]);
    await coordinator.permitCurrent();
    expect(applied).toEqual(["b", "c"]);
  });

  it("rejects a delayed old preparation when a newer source arrives", async () => {
    const { coordinator, prepare, applied } = fixture();
    const old = Promise.withResolvers<string>();
    prepare.mockReturnValueOnce(old.promise);
    const first = coordinator.accept({ effects: [source("b")], errors: [] });
    const second = coordinator.accept({ effects: [source("c")], errors: [] });
    old.resolve("old");
    await Promise.all([first, second]);
    await vi.waitFor(() => expect(applied).toEqual(["c"]));
  });

  it("does not starve preparation when repeated snapshots have the same version", async () => {
    const { coordinator, prepare, applied } = fixture();
    const pending = Promise.withResolvers<string>();
    prepare.mockReturnValueOnce(pending.promise);
    const first = coordinator.accept({ effects: [source("b")], errors: [] });
    const repeated = coordinator.accept({ effects: [source("b")], errors: [] });
    pending.resolve("prepared");
    await Promise.all([first, repeated]);
    expect(applied).toEqual(["b"]);
    expect(prepare).toHaveBeenCalledOnce();
  });

  it.each(["edit", "selection", "close"] as const)(
    "does not apply after %s during preparation",
    async (change) => {
      const { coordinator, prepare, state, applied } = fixture();
      const pending = Promise.withResolvers<string>();
      prepare.mockReturnValueOnce(pending.promise);
      const loading = coordinator.accept({
        effects: [source("b")],
        errors: [],
      });
      if (change === "edit") {
        state.editor = "edited during decode";
        state.dirty = true;
      }
      if (change === "selection") state.identity = {};
      if (change === "close") coordinator.close();
      pending.resolve("prepared");
      await loading;
      expect(applied).toEqual([]);
    },
  );

  it("rechecks edits at the apply boundary after an asynchronous flush", async () => {
    const { coordinator, apply, state, applied } = fixture();
    const flush = Promise.withResolvers<void>();
    apply.mockImplementationOnce(
      async (_prepared, _entry, _target, canCommit) => {
        await flush.promise;
        if (!canCommit()) return false;
        applied.push("wrong");
        return true;
      },
    );
    const loading = coordinator.accept({ effects: [source("b")], errors: [] });
    await vi.waitFor(() => expect(apply).toHaveBeenCalledOnce());
    state.editor = "new edit";
    state.dirty = true;
    flush.resolve();
    await loading;
    expect(applied).toEqual([]);
  });

  it("keeps failed candidates until an explicit retry succeeds", async () => {
    const { coordinator, prepare, applied, notice } = fixture();
    prepare.mockRejectedValueOnce(new Error("decode failed"));
    await coordinator.accept({ effects: [source("b")], errors: [] });
    await coordinator.sync();
    expect(prepare).toHaveBeenCalledOnce();
    expect(notice).toHaveBeenLastCalledWith("failed");
    await coordinator.permitCurrent();
    expect(applied).toEqual(["b"]);
  });
});
