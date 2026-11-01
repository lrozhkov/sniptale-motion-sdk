import { delimiter, resolve } from "node:path";
import { expect, it } from "vitest";
import { initializeQaEnvironment } from "./environment.ts";

it("keeps parent and nested npm proof environments equivalent and requires browser acceptance", () => {
  const modules = resolve("node_modules/.bin");
  const parent: NodeJS.ProcessEnv = {
    PATH: [modules, "/usr/bin"].join(delimiter),
    MOTION_NPM_BROWSER_ACCEPT: "0",
  };
  initializeQaEnvironment(parent);
  const child = { ...parent, PATH: [modules, parent.PATH].join(delimiter) };
  initializeQaEnvironment(child);
  expect(child).toEqual(parent);
  expect(parent.MOTION_NPM_BROWSER_ACCEPT).toBe("1");
  expect(parent.PLAYWRIGHT_BROWSERS_PATH).toBe(resolve(".tmp/playwright"));
});
