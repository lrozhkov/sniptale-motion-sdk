import { createSmokeRuntime } from "./runtime.mjs";
import { runSmokeScenarios } from "../../../tests/smoke/scenarios/main-flow.mjs";

const runtime = await createSmokeRuntime();

try {
  await runSmokeScenarios(runtime);
} finally {
  await runtime.close();
}
