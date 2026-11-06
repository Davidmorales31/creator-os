import assert from "node:assert/strict";
import { isEditableKeyboardTarget, timelineShortcutForKey } from "../apps/desktop/src/timeline-shortcuts.ts";

const event = (key, overrides = {}) => ({
  key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
  repeat: false, isComposing: false, ...overrides,
});
const cases = [
  [event("z", { ctrlKey: true }), "undo"],
  [event("Z", { metaKey: true }), "undo"],
  [event("z", { ctrlKey: true, shiftKey: true }), "redo"],
  [event("Z", { metaKey: true, shiftKey: true }), "redo"],
  [event("y", { ctrlKey: true }), "redo"],
  [event("s"), "split"],
  [event("Delete"), "delete"],
  [event("Backspace"), "delete"],
  [event("z"), null],
  [event("y", { metaKey: true }), null],
  [event("s", { ctrlKey: true }), null],
  [event("s", { shiftKey: true }), null],
  [event("Delete", { shiftKey: true }), null],
  [event("Backspace", { altKey: true }), null],
  [event("z", { ctrlKey: true, altKey: true }), null],
  [event("z", { ctrlKey: true, metaKey: true }), null],
  [event("z", { ctrlKey: true, repeat: true }), null],
  [event("Delete", { repeat: true }), null],
  [event("s", { isComposing: true }), null],
];
for (const [keyboard, expected] of cases) {
  assert.equal(timelineShortcutForKey(keyboard), expected, JSON.stringify(keyboard));
}
for (const keyboard of [
  event("z", { ctrlKey: true }), event("Delete"), event("s"),
]) {
  assert.equal(timelineShortcutForKey(keyboard, true), null, "Editable targets must own their keys");
}
assert.equal(isEditableKeyboardTarget(null), false);
assert.equal(isEditableKeyboardTarget({ closest: () => null }), false);
for (const tag of ["input", "textarea", "select", "contenteditable"]) {
  assert.equal(isEditableKeyboardTarget({
    closest: (selector) => selector.includes(tag) ? {} : null,
  }), true, `Avoid stealing keyboard shortcuts from ${tag}`);
}
console.log("Timeline focused keyboard shortcut mapping and editable-input isolation passed");
