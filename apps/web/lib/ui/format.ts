import { formatLocalTime, formatShortDate, type Prophecy, type SourceKind } from '@morrow/core';

/** 3200 → "3.2 KB" */
export const formatKb = (bytes: number) => `${(bytes / 1000).toFixed(1)} KB`;

/** ISO instant → `09.30` in the given time zone. */
export function shortDateOf(iso: string, timeZone: string): string {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  return formatShortDate(d);
}

export { formatLocalTime, formatShortDate };

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const numberWord = (n: number) => WORDS[n] ?? String(n);

/** Footnote for a prophecy panel, e.g. "Came true seven days early." */
export function prophecyFootnote(p: Prophecy): string {
  if (p.status === 'open') return "I'll tell you when it lands.";
  if (p.status === 'expired') return 'The window closed.';
  const early = Math.round((Date.parse(p.windowEnd) - Date.parse(p.resolvedAt ?? p.windowEnd)) / 86_400_000);
  if (early >= 2) return `Came true ${numberWord(early)} days early.`;
  if (early === 1) return 'Came true a day early.';
  return 'Came true just in time.';
}

const SOURCE_NAMES: Record<SourceKind, string> = { calendar: 'Calendar', spotify: 'Spotify', mail: 'Mail', instagram: 'Instagram' };
export const sourceName = (k: SourceKind) => SOURCE_NAMES[k];

/** First sentence of a headline, for list rows. */
export function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](?=\s|$)/);
  return m ? m[0] : text;
}
