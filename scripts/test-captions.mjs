import assert from "node:assert/strict";
import { captionAt, eligibleCaptions } from "../apps/desktop/src/caption-cues.ts";

const cues = [
  { startMs: 0, endMs: 1550, text: "Primera línea" },
  { startMs: 2000, endMs: 3300, text: "Segunda línea" },
];
assert.equal(eligibleCaptions(cues), true);
assert.equal(captionAt(cues, 0)?.text, "Primera línea");
assert.equal(captionAt(cues, 1.549)?.text, "Primera línea");
assert.equal(captionAt(cues, 1.55), null, "end boundary is exclusive");
assert.equal(captionAt(cues, 1.9), null, "gaps display no text");
assert.equal(captionAt(cues, 2)?.text, "Segunda línea");
assert.equal(captionAt(cues, 3.3), null);
assert.equal(captionAt(cues, -1), null);
assert.equal(captionAt(cues, Number.NaN), null);
assert.equal(captionAt([], 0), null);
const overlapping = [
  { startMs: 0, endMs: 4000, text: "Old" },
  { startMs: 2000, endMs: 3000, text: "Latest" },
];
assert.equal(captionAt(overlapping, 2.5)?.text, "Latest");
assert.equal(captionAt(overlapping, 3.5)?.text, "Old");
assert.equal(eligibleCaptions(overlapping), true);
assert.equal(eligibleCaptions([{ startMs: 100, endMs: 50, text: "Invalid" }]), false);
assert.equal(eligibleCaptions([{ startMs: 100, endMs: 200, text: "" }]), false);
assert.equal(eligibleCaptions([{ startMs: 100, endMs: 200, text: "a" }, { startMs: 0, endMs: 30, text: "b" }]), false);
console.log("Creator OS caption cue boundary tests passed.");
