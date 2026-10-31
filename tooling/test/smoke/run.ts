import { createSmokeRuntime } from "./runtime.ts";
import { runSmokeScenarios } from "../../../tests/smoke/scenarios/main-flow.ts";

const runtime = await createSmokeRuntime();

try {
  await runSmokeScenarios(runtime);
} catch (error) {
  await runtime.close().catch(() => {});
  throw error;
}
await runtime.close();
