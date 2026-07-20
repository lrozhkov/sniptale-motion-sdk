import { createServer } from "vite";

process.env.EFFECT_SDK_INCLUDE_LOCAL_DEMO_PACK = "1";

const viewer = await createServer({
  configFile: "tooling/configs/vite/viewer.ts",
});
const sandbox = await createServer({
  configFile: "tooling/configs/vite/sandbox.ts",
});

await viewer.listen();
await sandbox.listen();

viewer.printUrls();
sandbox.printUrls();
console.log("Viewer:  http://127.0.0.1:4177/");
console.log("Sandbox: http://127.0.0.1:4178/sandbox.html");

const close = async () => {
  await Promise.allSettled([viewer.close(), sandbox.close()]);
  process.exit(0);
};

process.on("SIGINT", close);
process.on("SIGTERM", close);
