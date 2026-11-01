// Native preload: Node runs --require before the TypeScript loader and its cache initialization.
const filesystem = require("node:fs");
const path = require("node:path");

const temporaryRoot = path.resolve(__dirname, "../../.tmp/runtime-tmp");
filesystem.mkdirSync(temporaryRoot, { recursive: true, mode: 0o700 });
process.env.TMPDIR = temporaryRoot;
process.env.TMP = temporaryRoot;
process.env.TEMP = temporaryRoot;
