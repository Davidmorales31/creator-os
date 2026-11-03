import type { TranscriptSegment } from "./transcription";

/**
 * Creator OS preview cue selection. Segments belong to the original media,
 * not the edited timeline. The right boundary is exclusive: [startMs, endMs).
 * Overlaps resolve to the segment with the latest start time, deterministically.
 */
export function captionAt(segments: readonly TranscriptSegment[], seconds: number): TranscriptSegment | null {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const now = Math.floor(seconds * 1000);
  let lo = 0;
  let hi = segments.length;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (segments[mid].startMs <= now) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo - 1; i >= 0; i -= 1) {
    const segment = segments[i];
    if (Number.isSafeInteger(segment.startMs) && Number.isSafeInteger(segment.endMs)
      && segment.startMs >= 0 && segment.endMs > segment.startMs
      && now >= segment.startMs && now < segment.endMs && segment.text.trim()) {
      return segment;
    }
  }
  return null;
}

export function eligibleCaptions(segments: readonly TranscriptSegment[]): boolean {
  if (segments.length === 0 || segments.length > 100_000) return false;
  let lastStart = -1;
  for (const cue of segments) {
    if (!Number.isSafeInteger(cue.startMs) || !Number.isSafeInteger(cue.endMs)
      || cue.startMs < 0 || cue.endMs <= cue.startMs || cue.startMs < lastStart
      || cue.text.trim().length === 0 || cue.text.length > 20_000) return false;
    lastStart = cue.startMs;
  }
  return true;
}
