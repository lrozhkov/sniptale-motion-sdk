import { describe, expect, it, vi } from "vitest";

import {
  PLAYBACK_VIDEO_CACHE_SCHEMA_VERSION,
  normalizePlaybackVideoCacheRecord,
} from "../src/apps/viewer/playback/video-cache-model";
import { createPlaybackVideoCacheStorage } from "../src/apps/viewer/playback/video-cache-storage";

describe("viewer persistent playback video cache", () => {
  it("validates persisted browser records at the storage boundary", () => {
    const blob = new Blob(["video"], { type: "video/mp4" });
    const record = normalizePlaybackVideoCacheRecord(
      {
        accessedAt: 20,
        bytes: 999,
        codec: "avc",
        contentKey: "content-key",
        createdAt: 10,
        duration: 5,
        fps: 30,
        height: 2160,
        key: "cache-key",
        mimeType: "video/mp4",
        rangeEndFrame: 91,
        rangeEndTime: 3,
        rangeStartFrame: 30,
        rangeStartTime: 1,
        schemaVersion: PLAYBACK_VIDEO_CACHE_SCHEMA_VERSION,
        segments: [
          {
            blob,
            bytes: 999,
            endFrame: 91,
            endTime: 3,
            fingerprint: "segment-fingerprint",
            index: 0,
            startFrame: 30,
            startTime: 1,
          },
        ],
        templateId: "composition",
        width: 3840,
      },
      "cache-key",
    );

    if (!record) throw new Error("Expected a valid browser cache record.");
    expect(record).toMatchObject({
      bytes: blob.size,
      rangeEndFrame: 91,
      rangeStartFrame: 30,
    });
    const coercion = vi.fn(() => 30);
    for (const fps of ["30", false, null, Infinity, { valueOf: coercion }]) {
      expect(
        normalizePlaybackVideoCacheRecord({ ...record, fps }, "cache-key"),
      ).toBeNull();
    }
    expect(
      normalizePlaybackVideoCacheRecord(
        {
          ...record,
          segments: [
            { ...record.segments[0], startFrame: { valueOf: coercion } },
          ],
        },
        "cache-key",
      ),
    ).toBeNull();
    expect(coercion).not.toHaveBeenCalled();
    expect(
      normalizePlaybackVideoCacheRecord(
        { ...record, key: "foreign-key" },
        "cache-key",
      ),
    ).toBeNull();
    expect(
      normalizePlaybackVideoCacheRecord(
        {
          ...record,
          segments: [{ ...record.segments[0], blob: "not-a-blob" }],
        },
        "cache-key",
      ),
    ).toBeNull();
    expect(
      normalizePlaybackVideoCacheRecord(
        { ...record, codec: "vp9" },
        "cache-key",
      ),
    ).toBeNull();
  });

  it("fails cleanly when persistent browser storage is unavailable", async () => {
    const storage = createPlaybackVideoCacheStorage(undefined);

    await expect(storage.get("cache-key")).rejects.toThrow(
      "IndexedDB is unavailable",
    );
  });
});
