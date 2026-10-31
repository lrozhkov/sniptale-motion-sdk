import type { Server } from "node:http";
import type { Browser } from "@playwright/test";

type ServerResource = Pick<Server, typeof Symbol.asyncDispose>;
export async function closeSmokeResources(
  browser: Pick<Browser, "close"> | null,
  servers: readonly (ServerResource | null)[],
): Promise<void> {
  const pending: Promise<void>[] = [];
  if (browser) pending.push(Promise.resolve().then(() => browser.close()));
  for (const server of servers)
    if (server)
      pending.push(Promise.resolve().then(() => server[Symbol.asyncDispose]()));
  const outcomes = await Promise.allSettled(pending);
  const errors: unknown[] = [];
  for (const outcome of outcomes)
    if (outcome.status === "rejected") {
      const error: unknown = outcome.reason;
      errors.push(error);
    }
  if (errors.length)
    throw new AggregateError(errors, "Smoke resource shutdown failed.");
}
