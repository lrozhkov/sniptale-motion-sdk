const { createHash, randomUUID } = require("node:crypto");
const { createReadStream, createWriteStream } = require("node:fs");
const { rename, rm } = require("node:fs/promises");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");

// This owner runs before npm dependencies and TypeScript loaders are installed.
/**
 * @param {string} url
 * @param {string} destination
 * @param {string} sha256
 * @param {number} maximumBytes
 * @param {typeof fetch} [fetchArchive]
 * @returns {Promise<void>}
 */
async function downloadPinnedArchive(
  url,
  destination,
  sha256,
  maximumBytes,
  fetchArchive = fetch,
) {
  if (
    !/^[a-f0-9]{64}$/u.test(sha256) ||
    !Number.isSafeInteger(maximumBytes) ||
    maximumBytes <= 0
  )
    throw new Error(
      "A pinned download needs a SHA-256 and positive byte limit.",
    );
  const temporary = `${destination}.${randomUUID()}.download`;
  try {
    const response = await fetchArchive(url, {
      signal: AbortSignal.timeout(300000),
    });
    if (!response.ok || !response.body)
      throw new Error(`Archive download failed: HTTP ${response.status}.`);
    const body = response.body;
    let received = 0;
    const limit = new Transform({
      /** @param {unknown} chunk */
      transform(chunk, _encoding, callback) {
        if (!Buffer.isBuffer(chunk)) {
          callback(new Error("Archive stream must contain bytes."));
          return;
        }
        received += chunk.length;
        callback(
          received > maximumBytes
            ? new Error("Archive exceeds its byte limit.")
            : null,
          chunk,
        );
      },
    });
    await pipeline(
      Readable.from(
        (async function* () {
          const reader = body.getReader();
          try {
            for (;;) {
              const item = await reader.read();
              if (item.done) break;
              yield item.value;
            }
          } finally {
            reader.releaseLock();
          }
        })(),
      ),
      limit,
      createWriteStream(temporary, { flags: "wx", mode: 0o600 }),
    );
    await assertPinnedArchive(temporary, sha256, maximumBytes);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}
/**
 * @param {string} file
 * @param {string} sha256
 * @param {number} maximumBytes
 * @returns {Promise<void>}
 */
async function assertPinnedArchive(file, sha256, maximumBytes) {
  const digest = createHash("sha256");
  let received = 0;
  for await (const chunk of createReadStream(file)) {
    /** @type {unknown} */
    const value = chunk;
    if (!Buffer.isBuffer(value))
      throw new Error("Archive stream must contain bytes.");
    received += value.length;
    if (received > maximumBytes)
      throw new Error("Archive exceeds its byte limit.");
    digest.update(value);
  }
  if (digest.digest("hex") !== sha256)
    throw Object.assign(new Error("Archive SHA-256 mismatch."), {
      code: "ARCHIVE_DIGEST",
    });
}
module.exports = { downloadPinnedArchive, assertPinnedArchive };
