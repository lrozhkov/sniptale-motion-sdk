import { afterEach, describe, expect, it, vi } from "vitest";
import {
  inspectMotionBrowser,
  launchMotionBrowser,
} from "../src/apps/cli/browser/runtime";
import { runMotionCli } from "../src/apps/cli/commands";

const launch = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<unknown>>(),
);
vi.mock("playwright-core", () => ({ chromium: { launch } }));
afterEach(() => {
  launch.mockReset();
});
function browser(version = "156.0.8078.4") {
  return { version: () => version, close: vi.fn(async () => {}) };
}

describe("optional installed browser runtime", () => {
  it("prefers installed Chrome then Edge and records the actual version", async () => {
    const edge = browser();
    launch.mockRejectedValueOnce(new Error("private executable path"));
    launch.mockResolvedValueOnce(edge);
    const result = await launchMotionBrowser();
    expect(result.channel).toBe("msedge");
    expect(result.version).toBe("156.0.8078.4");
    expect(launch.mock.calls.map((args) => args[0])).toMatchObject([
      { channel: "chrome" },
      { channel: "msedge" },
    ]);
    await result.browser.close();
    expect(edge.close).toHaveBeenCalledOnce();
  });

  it("uses only an explicitly selected channel and closes a diagnostic probe", async () => {
    const chromium = browser();
    launch.mockResolvedValueOnce(chromium);
    expect(await inspectMotionBrowser({ channel: "chromium" })).toMatchObject({
      status: "available",
      channel: "chromium",
    });
    expect(launch).toHaveBeenCalledOnce();
    expect(launch).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "chromium", headless: true }),
    );
    expect(chromium.close).toHaveBeenCalledOnce();
  });

  it("reports an unavailable browser without leaking backend messages or failing browserless work", async () => {
    launch.mockRejectedValue(new Error("SECRET /private/profile/path"));
    const value = await inspectMotionBrowser({ locale: "en" });
    expect(value).toMatchObject({
      status: "unavailable",
      nextCommand: "sniptale-motion browser install",
    });
    expect(JSON.stringify(value)).not.toMatch(/SECRET|private\/profile/);
    expect(launch.mock.calls.map((args) => args[0])).toMatchObject([
      { channel: "chrome" },
      { channel: "msedge" },
      { channel: "chromium" },
    ]);
    let stdout = "";
    expect(
      await runMotionCli(["doctor", "--json"], {
        cwd: ".",
        packageRoot: ".",
        version: "0.1.0",
        stdout: (text) => {
          stdout += text;
        },
        stderr: () => {},
      }),
    ).toBe(0);
    expect(JSON.parse(stdout)).toMatchObject({
      ok: true,
      browser: { status: "unavailable" },
    });
  });

  it("closes a browser that completes launch after cancellation and does not try another channel", async () => {
    const started = Promise.withResolvers<unknown>();
    const controller = new AbortController();
    const instance = browser();
    launch.mockReturnValueOnce(started.promise);
    const pending = launchMotionBrowser({ signal: controller.signal });
    await vi.waitFor(() => expect(launch).toHaveBeenCalledOnce());
    controller.abort();
    started.resolve(instance);
    await expect(pending).rejects.toThrow();
    expect(instance.close).toHaveBeenCalledOnce();
    expect(launch).toHaveBeenCalledOnce();
  });

  it("rejects a malformed browser version before reporting availability", async () => {
    const instance = browser("invalid private version");
    launch.mockResolvedValueOnce(instance);
    expect(await inspectMotionBrowser({ channel: "chromium" })).toMatchObject({
      status: "unavailable",
    });
    expect(instance.close).toHaveBeenCalledOnce();
  });
});
