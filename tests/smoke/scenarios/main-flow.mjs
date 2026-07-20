import { assertEffectV1MainFlow } from "./effect-v1-main-flow.mjs";

export async function runSmokeScenarios(runtime) {
  await assertEffectV1MainFlow(runtime);
}
