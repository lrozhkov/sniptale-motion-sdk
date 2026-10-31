import type { Browser } from "playwright-core";
import { MotionCliError } from "../errors.js";
import type { Locale } from "../../../shared/i18n/config.js";
import { cliMessages } from "../../../shared/i18n/cli.js";

export const BROWSER_CHANNELS = ["chrome", "msedge", "chromium"] as const;
export type BrowserChannel = (typeof BROWSER_CHANNELS)[number];
export type MotionBrowser = {
  browser: Browser;
  channel: BrowserChannel;
  version: string;
};
export type BrowserOptions = {
  channel?: BrowserChannel;
  signal?: AbortSignal;
  locale?: Locale;
};

export async function launchMotionBrowser(
  options: BrowserOptions = {},
): Promise<MotionBrowser> {
  options.signal?.throwIfAborted();
  const { chromium } = await import("playwright-core");
  for (const channel of options.channel
    ? [options.channel]
    : BROWSER_CHANNELS) {
    options.signal?.throwIfAborted();
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({
        channel,
        headless: true,
        timeout: 10_000,
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
      });
      options.signal?.throwIfAborted();
      const version: unknown = browser.version();
      if (typeof version !== "string" || !/^\d+(?:\.\d+){1,3}$/.test(version))
        throw new Error("BROWSER_VERSION");
      return { browser, channel, version };
    } catch {
      await browser?.close();
      options.signal?.throwIfAborted();
    }
  }
  throw new MotionCliError(
    "BROWSER_UNAVAILABLE",
    cliMessages(options.locale ?? "ru").browserUnavailable,
  );
}

export async function inspectMotionBrowser(options: BrowserOptions = {}) {
  try {
    const { browser, channel, version } = await launchMotionBrowser(options);
    try {
      return { status: "available", channel, version, requiredFor: ["prove"] };
    } finally {
      await browser.close();
    }
  } catch (error) {
    options.signal?.throwIfAborted();
    if (
      !(error instanceof MotionCliError) ||
      error.code !== "BROWSER_UNAVAILABLE"
    )
      throw error;
    return {
      status: "unavailable",
      requiredFor: ["prove"],
      message: error.message,
      nextCommand: "sniptale-motion browser install",
    };
  }
}
