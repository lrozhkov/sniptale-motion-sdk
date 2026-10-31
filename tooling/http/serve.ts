import { startStaticServer } from "./static-server.ts";

const viewerRoot = process.env.EFFECT_SDK_VIEWER_ROOT || "dist/apps/viewer";
const sandboxRoot = process.env.EFFECT_SDK_SANDBOX_ROOT || "dist/apps/sandbox";

const viewer = await startStaticServer(
  viewerRoot,
  Number(process.env.VIEWER_PORT || 4177),
);
const sandbox = await startStaticServer(
  sandboxRoot,
  Number(process.env.SANDBOX_PORT || 4178),
);

console.log("Viewer:  http://127.0.0.1:4177/");
console.log("Sandbox: http://127.0.0.1:4178/sandbox.html");

const close = () => {
  viewer.close();
  sandbox.close();
  process.exit(0);
};

process.on("SIGINT", close);
process.on("SIGTERM", close);
