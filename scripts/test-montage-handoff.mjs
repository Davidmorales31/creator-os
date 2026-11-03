import assert from "node:assert/strict";
import { handoffKey, shouldAdvanceMontage, canStartAfterSeek } from "../apps/desktop/src/montage-handoff.ts";

const segment = { clipId: "first", assetId: "a", timelineStartFrame: 0, sourceStartFrame: 45, durationFrames: 30 };
const key = handoffKey("run", 0);
const seeking = { key, phase: "seeking" };
const playing = { key, phase: "playing" };
assert.equal(canStartAfterSeek(seeking, key, 1.5, 1.5, false, 30), true);
assert.equal(canStartAfterSeek(seeking, key, 1.48, 1.5, false, 30), false, "outside half-frame tolerance");
assert.equal(canStartAfterSeek(seeking, key, 1.5, 1.5, true, 30), false);
assert.equal(canStartAfterSeek(playing, key, 1.5, 1.5, false, 30), false, "cannot start twice");
assert.equal(canStartAfterSeek(seeking, handoffKey("another", 0), 1.5, 1.5, false, 30), false);
assert.equal(shouldAdvanceMontage(seeking, key, segment, 30, 2.5, true), false, "stale ended during seek");
assert.equal(shouldAdvanceMontage(playing, key, segment, 30, 2.49, false), false);
assert.equal(shouldAdvanceMontage(playing, key, segment, 30, 2.5, false), true);
assert.equal(shouldAdvanceMontage(playing, key, segment, 30, 1.6, true), true);
assert.equal(shouldAdvanceMontage(playing, handoffKey("run", 1), segment, 30, 2.5, true), false);
assert.equal(shouldAdvanceMontage({ key, phase: "finished" }, key, segment, 30, 2.5, true), false);
console.log("Creator OS montage handoff lifecycle tests passed");
