import { runQaWrapper } from "../runtime/wrapper-runner.ts";

await runQaWrapper("qa:build", async ({ run }) => {
  await run("local fixture build", "npm", ["run", "build:local"]);
  await run("browser smoke", "npm", ["run", "test:smoke"]);
  await run("release build", "npm", ["run", "build"]);
});
