/**
 * Each service gets a timetable colour (classes .subject-0 … .subject-5 in
 * globals.css). Colours follow the order the tutor created services in, so a
 * subject keeps its colour everywhere: booking page, dashboard, emails.
 */
export const SUBJECT_COUNT = 6;

/** Solid colours, for places without CSS classes (emails). Same order as globals.css. */
export const SUBJECT_HEX = ["#2f5bff", "#ff6b2c", "#12a37a", "#c2389b", "#e0a100", "#0f8fb8"] as const;

export const subjectClass = (index: number) => `subject-${((index % SUBJECT_COUNT) + SUBJECT_COUNT) % SUBJECT_COUNT}`;

/** Service id → colour index, from services listed oldest first. */
export function subjectIndex(serviceIdsOldestFirst: string[]): Map<string, number> {
  return new Map(serviceIdsOldestFirst.map((id, i) => [id, i % SUBJECT_COUNT]));
}
