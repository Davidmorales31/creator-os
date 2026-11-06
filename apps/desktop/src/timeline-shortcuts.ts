/** Scope keyboard editing to the focused timeline. Rust remains the sole editor state owner. */
export type TimelineShortcut = "undo" | "redo" | "split" | "delete";

type KeyboardIntent = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "repeat" | "isComposing"
>;

/** Never steal browser/text input undo, typing, IME or editable widget shortcuts. */
export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const node = target as { closest?: (selector: string) => Element | null } | null;
  return Boolean(
    node?.closest?.("input, textarea, select, [contenteditable]:not([contenteditable='false'])"),
  );
}

/** Pure key mapping; the host must additionally verify selected clip/history and focus scope. */
export function timelineShortcutForKey(
  event: KeyboardIntent,
  editableTarget = false,
): TimelineShortcut | null {
  if (editableTarget || event.isComposing || event.repeat || event.altKey
      || (event.ctrlKey && event.metaKey)) return null;
  const key = event.key.toLowerCase();
  const command = event.ctrlKey || event.metaKey;

  if (command) {
    if (key === "z") return event.shiftKey ? "redo" : "undo";
    if (key === "y" && event.ctrlKey && !event.shiftKey) return "redo";
    return null;
  }
  if (event.shiftKey) return null;
  if (key === "s") return "split";
  if (key === "delete" || key === "backspace") return "delete";
  return null;
}
