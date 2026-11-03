import assert from "node:assert/strict";
import { planMontage, montageFrameAtSource, montageClipEndSeconds } from "../apps/desktop/src/montage-plan.ts";

const video = (id, duration = 10) => ({
  id, kind: "video", fileName: id + ".mp4", durationSeconds: duration,
});
const clip = (id, assetId, startFrame, sourceInFrame, durationFrames, trackId = "video-1") => ({
  id, assetId, trackId, kind: "video", startFrame, sourceInFrame, durationFrames, sourceLengthFrames: 300,
});
const tracks = [{ id: "video-1", kind: "video", name: "Video 1" }, { id: "audio-1", kind: "audio", name: "Audio 1" }];
const t = (clips) => ({ schemaVersion: 1, revision: 3, tracks, clips, undoStack: [], redoStack: [] });

const first = clip("a", "source", 0, 30, 30);
const second = clip("b", "source", 30, 120, 60);
const p = planMontage(t([second, first]), [video("source")], 30);
assert.equal(p.ok, true);
assert.equal(p.plan.totalFrames, 90);
assert.deepEqual(p.plan.segments.map((s) => [s.clipId, s.sourceStartFrame]), [["a", 30], ["b", 120]]);
assert.equal(montageFrameAtSource(p.plan.segments[0], 1, 30), 0);
assert.equal(montageFrameAtSource(p.plan.segments[0], 1.96, 30), 28);
assert.equal(montageFrameAtSource(p.plan.segments[0], 2, 30), null, "exclusive end");
assert.equal(montageClipEndSeconds(p.plan.segments[0], 30), 2);
assert.equal(planMontage(t([first, clip("c", "other", 30, 0, 30)]), [video("source"), video("other")], 30).ok, true, "different assets");
assert.match(planMontage(t([first, clip("gap", "source", 45, 0, 30)]), [video("source")], 30).reason, /espacio vacío/);
assert.match(planMontage(t([first, clip("overlap", "source", 20, 0, 30)]), [video("source")], 30).reason, /superpuestos/);
assert.match(planMontage(t([first, clip("aud", "source", 30, 0, 30, "audio-1")]), [video("source")], 30).reason, /una sola pista/);
assert.match(planMontage(t([first]), [], 30).reason, /video importado/);
assert.match(planMontage(t([clip("bad", "source", 0, 280, 40)]), [video("source")], 30).reason, /recorte supera/);
assert.equal(planMontage(t([]), [video("source")], 30).ok, false);
console.log("Creator OS montage plan tests passed");
