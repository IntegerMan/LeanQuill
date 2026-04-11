/** Bounded manuscript matching for `span_hint` (D-13). */

export type SpanHintResolution =
  | { kind: "matched"; start: number; end: number }
  | { kind: "stale" }
  | { kind: "ambiguous"; candidates: Array<{ start: number; end: number }> };

const FUZZY_WINDOW_HALF = 1200;

const MIN_PARTIAL_LEN = 3;

function normalizeSpanHint(spanHint: string): string {
  let s = spanHint.replace(/\.\.\./g, "").replace(/…/g, "").trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s.trim();
}

function allOccurrences(fullText: string, fragment: string): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  if (!fragment) {
    return out;
  }
  let from = 0;
  while (from <= fullText.length) {
    const i = fullText.indexOf(fragment, from);
    if (i === -1) {
      break;
    }
    out.push({ start: i, end: i + fragment.length });
    from = i + 1;
  }
  return out;
}

function overlapsWindow(start: number, end: number, winStart: number, winEnd: number): boolean {
  return start < winEnd && end > winStart;
}

function pickClosest(cands: Array<{ start: number; end: number }>, preferredStartIndex: number): {
  start: number;
  end: number;
} {
  let best = cands[0];
  let bestDist = Math.abs(best.start - preferredStartIndex);
  for (let i = 1; i < cands.length; i++) {
    const c = cands[i];
    const d = Math.abs(c.start - preferredStartIndex);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

function fuzzyPartialInWindow(
  fullText: string,
  fragment: string,
  preferredStartIndex: number,
): SpanHintResolution {
  const winStart = Math.max(0, preferredStartIndex - FUZZY_WINDOW_HALF);
  const winEnd = Math.min(fullText.length, preferredStartIndex + FUZZY_WINDOW_HALF);
  const windowSlice = fullText.slice(winStart, winEnd);

  const maxLen = Math.min(fragment.length, windowSlice.length);
  for (let len = maxLen; len >= MIN_PARTIAL_LEN; len--) {
    for (let off = 0; off + len <= fragment.length; off++) {
      const sub = fragment.slice(off, off + len);
      const pos = windowSlice.indexOf(sub);
      if (pos !== -1) {
        return { kind: "matched", start: winStart + pos, end: winStart + pos + sub.length };
      }
    }
  }

  return { kind: "stale" };
}

/**
 * Resolve a `span_hint` fragment within manuscript text (exact, stale, bounded fuzzy — D-13).
 */
export function resolveSpanHintInDocument(
  fullText: string,
  spanHint: string,
  preferredStartIndex?: number,
): SpanHintResolution {
  const fragment = normalizeSpanHint(spanHint);
  if (!fragment) {
    return { kind: "stale" };
  }

  const globalHits = allOccurrences(fullText, fragment);

  if (globalHits.length === 1) {
    return { kind: "matched", start: globalHits[0].start, end: globalHits[0].end };
  }

  if (globalHits.length > 1) {
    if (preferredStartIndex !== undefined) {
      const winStart = Math.max(0, preferredStartIndex - FUZZY_WINDOW_HALF);
      const winEnd = Math.min(fullText.length, preferredStartIndex + FUZZY_WINDOW_HALF);
      const inWin = globalHits.filter((h) => overlapsWindow(h.start, h.end, winStart, winEnd));
      if (inWin.length === 1) {
        return { kind: "matched", start: inWin[0].start, end: inWin[0].end };
      }
      if (inWin.length > 1) {
        const best = pickClosest(inWin, preferredStartIndex);
        return { kind: "matched", start: best.start, end: best.end };
      }
      return fuzzyPartialInWindow(fullText, fragment, preferredStartIndex);
    }
    return { kind: "ambiguous", candidates: globalHits };
  }

  if (preferredStartIndex !== undefined) {
    return fuzzyPartialInWindow(fullText, fragment, preferredStartIndex);
  }

  return { kind: "stale" };
}
