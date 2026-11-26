import { useLayoutEffect, useRef, useState } from "react";
import { PanResponder, useWindowDimensions, type GestureResponderHandlers } from "react-native";

import type { WorkspaceRow } from "@/features/home/model";

/** How far a finger moves sideways before the bar takes it as a swipe. */
const SLOP = 16;
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

/**
 * On iOS, a sideways swipe that starts on the bar changes to the next or the previous Workspace.
 * The bar is native, so its buttons keep their taps and touch and hold; this sees the same
 * touches and claims a sideways move. `barTop` is the bar's top edge, up from the bottom of the
 * screen. Android's bar takes the swipe itself, since Compose keeps its touches from JavaScript.
 */
export function useBarSwipe(
  rows: readonly WorkspaceRow[],
  selected: string,
  onSwitch: (row: WorkspaceRow) => void,
  barTop: number,
): GestureResponderHandlers {
  const { height } = useWindowDimensions();
  const latest = useRef({ rows, selected, onSwitch, top: height - barTop });
  useLayoutEffect(() => {
    latest.current = { rows, selected, onSwitch, top: height - barTop };
  });
  // One responder for the screen's life, so a re-render never drops a swipe under way. Its
  // callbacks read the ref during touches, not during render.
  // eslint-disable-next-line react/refs
  const [responder] = useState(() =>
    PanResponder.create({
      // The gesture's own start point is set only once claimed, so it is worked out from here.
      onMoveShouldSetPanResponder: (event, gesture) =>
        event.nativeEvent.pageY - gesture.dy >= latest.current.top &&
        Math.abs(gesture.dx) > SLOP &&
        Math.abs(gesture.dx) > 2 * Math.abs(gesture.dy),
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) < SWIPE_DISTANCE) return;
        const { rows, selected, onSwitch } = latest.current;
        const next = swipedTo(rows, selected, gesture.dx < 0 ? "left" : "right");
        if (next !== undefined) onSwitch(next);
      },
    }),
  );
  return responder.panHandlers;
}
