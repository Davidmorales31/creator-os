import assert from "node:assert/strict";
import { previewAtFrame, previewClipAt, timelineFrameFromSource } from "../apps/desktop/src/timeline-preview.ts";

const timeline = {
  schemaVersion: 1, revision: 0,
  tracks: [
    { id: "v-main", kind: "video", name: "Video 1" },
    { id: "v-broll", kind: "video", name: "Video 2" },
    { id: "audio-1", kind: "audio", name: "Audio 1" },
  ],
  clips: [
    { id: "first", assetId: "a", kind: "video", trackId: "v-main", startFrame: 0, sourceInFrame: 30, durationFrames: 30, sourceLengthFrames: 300 },
    { id: "next", assetId: "a", kind: "video", trackId: "v-main", startFrame: 45, sourceInFrame: 120, durationFrames: 30, sourceLengthFrames: 300 },
    { id: "broll", assetId: "b", kind: "video", trackId: "v-broll", startFrame: 0, sourceInFrame: 0, durationFrames: 90, sourceLengthFrames: 300 },
    { id: "sound", assetId: "music", kind: "audio", trackId: "audio-1", startFrame: 0, sourceInFrame: 0, durationFrames: 120, sourceLengthFrames: 300 },
  ],
  undoStack: [], redoStack: [],
};
assert.deepEqual(previewAtFrame(timeline, 0, 30)?.assetId, "a");
assert.equal(previewAtFrame(timeline, 0, 30)?.sourceSeconds, 1);
assert.equal(previewAtFrame(timeline, 29, 30)?.sourceSeconds, 59 / 30);
assert.equal(previewAtFrame(timeline, 30, 30)?.assetId, "b", "fallback to broll during main gap");
assert.equal(previewAtFrame(timeline, 45, 30)?.sourceSeconds, 4, "seek to trim offset in same source");
assert.equal(previewAtFrame(timeline, 75, 30)?.assetId, "b", "right boundary excludes main clip");
assert.equal(previewAtFrame(timeline, 90, 30), null, "no video at frame");
assert.equal(previewAtFrame(timeline, -1, 30), null);
assert.equal(previewAtFrame(timeline, Number.NaN, 30), null);
assert.equal(previewAtFrame(timeline, 0, 0), null);
assert.equal(previewClipAt(timeline.clips[3], 0, 30), null);
const target = previewAtFrame(timeline, 45, 30);
assert.equal(timelineFrameFromSource(target, 4, 30), 45);
assert.equal(timelineFrameFromSource(target, 4.5, 30), 60);
assert.equal(timelineFrameFromSource(target, 5, 30), null, "right boundary stops tracking");
assert.equal(timelineFrameFromSource(target, 3.9, 30), null, "outside trim range");
console.log("Timeline source-preview mapping tests passed");
