import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { execa } from "./process.ts";
import {
  verifyReleaseArtifact,
  writeDeclarationManifest,
} from "../release/artifact-boundary.ts";
import { runProductionLegalValidation } from "../release/dependency-legal/validate-production-legal.ts";

const RELEASE_LEGAL_PATHS = [
  "LICENSE",
  "LICENSES",
  "NOTICE",
  "THIRD_PARTY_DEPENDENCIES.json",
  "THIRD_PARTY_NOTICES.md",
];

const includeLocalDemoPack = process.argv.includes("--include-local-demo-pack");
const viewerBuildEnvironment = {
  ...process.env,
  EFFECT_SDK_INCLUDE_LOCAL_DEMO_PACK: includeLocalDemoPack ? "1" : "0",
};

await rm("dist", { force: true, recursive: true });
await execa(process.execPath, [
  "node_modules/@typescript/native/bin/tsc",
  "-p",
  "tooling/configs/typescript/sdk.json",
]);
await writeDeclarationManifest("dist");
await execa(
  "npx",
  ["vite", "build", "--config", "tooling/configs/vite/viewer.ts"],
  { env: viewerBuildEnvironment },
);
await execa(
  "npx",
  ["vite", "build", "--config", "tooling/configs/vite/sandbox.ts"],
  { env: viewerBuildEnvironment },
);
if (!includeLocalDemoPack) {
  for (const legalPath of RELEASE_LEGAL_PATHS) {
    await cp(legalPath, resolve("dist", legalPath), { recursive: true });
  }
  await runProductionLegalValidation({ outputRoot: resolve("dist") });
  await verifyReleaseArtifact("dist");
  console.log("Release artifact boundary passed.");
}
