import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bindTemplateSourceJson,
  saveBoundTemplateJson,
} from "../src/apps/viewer/effect-file/json-binding";
import { readPickedJsonHandle } from "../src/apps/viewer/effect-file/file-system";
import { readEditorTemplateSource } from "../src/apps/viewer/templates/source";

class Writable {
  abort = vi.fn(async () => {});
  close = vi.fn(async () => {});
  write = vi.fn(async (_text: string) => {});
}
class Handle {
  kind = "file";
  name = "effect.json";
  writable = new Writable();
  getFile = vi.fn(async () => new File(['{"id":"effect"}'], this.name));
  createWritable = vi.fn(async () => this.writable);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function fixture() {
  const handle = new Handle();
  const ctx = {
    state: {
      currentTemplate: readEditorTemplateSource({ id: "effect", duration: 1 }),
      templateFileHandle: readPickedJsonHandle([handle]),
      templateSelectionGeneration: 0,
    },
    refs: {
      timelineSaveStatus: { textContent: "initial", title: "" },
      saveJsonButton: { disabled: true },
    },
    deps: { t: (key: string, fallback?: string) => fallback ?? key },
    logDiagnostic: vi.fn(),
    validateBoundTemplateJson: vi.fn(() => true),
    assertExportable: vi.fn(() => true),
    buildCurrentTemplateJson: vi.fn(() => '{"id":"effect"}'),
  };
  const picker = vi.fn(async (): Promise<unknown> => [handle]);
  vi.stubGlobal("window", { showOpenFilePicker: picker });
  return { ctx, handle, picker };
}
beforeEach(() => {
  vi.stubGlobal("FileSystemFileHandle", Handle);
  vi.stubGlobal("FileSystemWritableFileStream", Writable);
});
afterEach(() => vi.unstubAllGlobals());

describe("JSON file browser boundary", () => {
  it("binds only a native file handle after reading and validating its JSON", async () => {
    const { ctx, handle } = fixture();
    await bindTemplateSourceJson(ctx);
    expect(ctx.validateBoundTemplateJson).toHaveBeenCalledWith({
      id: "effect",
    });
    expect(ctx.state.templateFileHandle).toBe(handle);
    expect(ctx.refs.saveJsonButton.disabled).toBe(false);
  });

  it.each<{ value: unknown }>([
    { value: null },
    { value: [] },
    { value: [{ kind: "file", name: "fake.json" }] },
  ])("rejects an invalid picker result %j", async ({ value }) => {
    const { ctx, picker } = fixture();
    picker.mockResolvedValue(value);
    await bindTemplateSourceJson(ctx);
    expect(ctx.validateBoundTemplateJson).not.toHaveBeenCalled();
    expect(ctx.refs.saveJsonButton.disabled).toBe(true);
    expect(ctx.refs.timelineSaveStatus.textContent).toBe(
      "Bind canceled or failed",
    );
  });

  it("discards a picker response after selection changes", async () => {
    const { ctx, picker, handle } = fixture();
    const picked = deferred<unknown>();
    picker.mockReturnValue(picked.promise);
    const operation = bindTemplateSourceJson(ctx);
    ctx.state.templateSelectionGeneration += 1;
    picked.resolve([handle]);
    await operation;
    expect(handle.getFile).not.toHaveBeenCalled();
    expect(ctx.refs.timelineSaveStatus.textContent).toBe("initial");
  });

  it("discards file text after the source changes", async () => {
    const { ctx, handle } = fixture();
    const text = deferred<string>();
    const file = new File(["{}"], "effect.json");
    file.text = () => text.promise;
    handle.getFile.mockResolvedValue(file);
    const operation = bindTemplateSourceJson(ctx);
    await vi.waitFor(() => expect(handle.getFile).toHaveBeenCalled());
    ctx.state.currentTemplate = readEditorTemplateSource({
      id: "other",
      duration: 1,
    });
    text.resolve('{"id":"effect"}');
    await operation;
    expect(ctx.validateBoundTemplateJson).not.toHaveBeenCalled();
    expect(ctx.logDiagnostic).not.toHaveBeenCalled();
  });

  it("writes the captured document and closes the original stream", async () => {
    const { ctx, handle } = fixture();
    await saveBoundTemplateJson(ctx);
    expect(handle.writable.write).toHaveBeenCalledWith('{"id":"effect"}');
    expect(handle.writable.close).toHaveBeenCalledOnce();
    expect(handle.writable.abort).not.toHaveBeenCalled();
    expect(ctx.refs.timelineSaveStatus.textContent).toBe("Saved effect.json");
  });

  it("aborts without writing when selection changes while opening a stream", async () => {
    const { ctx, handle } = fixture();
    const opened = deferred<Writable>();
    handle.createWritable.mockReturnValue(opened.promise);
    const operation = saveBoundTemplateJson(ctx);
    ctx.state.templateSelectionGeneration += 1;
    opened.resolve(handle.writable);
    await operation;
    expect(handle.writable.abort).toHaveBeenCalledOnce();
    expect(handle.writable.write).not.toHaveBeenCalled();
    expect(handle.writable.close).not.toHaveBeenCalled();
  });

  it("aborts a failed write without committing the stream", async () => {
    const { ctx, handle } = fixture();
    handle.writable.write.mockRejectedValue(new Error("disk full"));
    await saveBoundTemplateJson(ctx);
    expect(handle.writable.abort).toHaveBeenCalledOnce();
    expect(handle.writable.close).not.toHaveBeenCalled();
    expect(ctx.refs.timelineSaveStatus.textContent).toBe("Save failed");
  });

  it("aborts a write when the file is rebound before completion", async () => {
    const { ctx, handle } = fixture();
    const written = deferred<void>();
    handle.writable.write.mockReturnValue(written.promise);
    const operation = saveBoundTemplateJson(ctx);
    await vi.waitFor(() => expect(handle.writable.write).toHaveBeenCalled());
    const other = new Handle();
    ctx.state.templateFileHandle = readPickedJsonHandle([other]);
    written.resolve();
    await operation;
    expect(handle.writable.abort).toHaveBeenCalledOnce();
    expect(handle.writable.close).not.toHaveBeenCalled();
    expect(other.createWritable).not.toHaveBeenCalled();
    expect(ctx.refs.timelineSaveStatus.textContent).toBe("initial");
  });

  it("suppresses errors from an obsolete stream operation", async () => {
    const { ctx, handle } = fixture();
    const opened = deferred<Writable>();
    handle.createWritable.mockReturnValue(opened.promise);
    const operation = saveBoundTemplateJson(ctx);
    ctx.state.templateSelectionGeneration += 1;
    opened.reject(new Error("obsolete failure"));
    await operation;
    expect(ctx.logDiagnostic).not.toHaveBeenCalled();
    expect(ctx.refs.timelineSaveStatus.textContent).toBe("initial");
  });
});
