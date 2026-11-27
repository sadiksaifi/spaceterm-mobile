import type { WorkspaceRow } from "@/features/home/model";

/** How far a swipe goes before letting go changes Workspace. */
export const SWIPE_DISTANCE = 32;

/**
 * The Workspace a swipe along the bar brings: a swipe to the left brings the next one, as a page
 * turns. `undefined` past either end.
 */
export function swipedTo(
  rows: readonly WorkspaceRow[],
  selected: string,
  direction: "left" | "right",
): WorkspaceRow | undefined {
  const at = rows.findIndex((row) => row.key === selected);
  return at === -1 ? undefined : rows[at + (direction === "left" ? 1 : -1)];
}
