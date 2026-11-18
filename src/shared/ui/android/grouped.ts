/** Grouped cards on Android: 16 dp outside corners, 4 dp inside, rows 2 dp apart. */
const OUTER_CORNER = 16;
const INNER_CORNER = 4;
export const GROUPED_GAP = 2;

/** The corners of a row in a grouped card, by where it sits in the group. */
export function groupedCorners(first: boolean, last: boolean) {
  const top = first ? OUTER_CORNER : INNER_CORNER;
  const bottom = last ? OUTER_CORNER : INNER_CORNER;
  return { topStart: top, topEnd: top, bottomStart: bottom, bottomEnd: bottom };
}
