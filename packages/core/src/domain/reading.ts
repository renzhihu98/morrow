import { QUESTION_LIMIT } from '../constants';
import type { Reading } from '../schemas/reading';
import { getReadingDate } from './date';

/** True if the reading is not sealed and `now` still falls on its reading day. */
export function isReadingOpen(reading: Pick<Reading, 'status' | 'localDate' | 'timezone'>, now: Date): boolean {
  return reading.status === 'open' && getReadingDate(now, reading.timezone) === reading.localDate;
}

/** Questions remaining today (never negative). */
export function questionsLeft(reading: Pick<Reading, 'questionCount'>): number {
  return Math.max(0, QUESTION_LIMIT - reading.questionCount);
}
