import { useCallback, useSyncExternalStore } from "react";

import { NO_GRID_STATE, type GridState } from "./grid";

/**
 * Each Workspace's grid state, by `machineId/workspaceId`, while the app runs. It outlives the
 * screen, so a Workspace shows the same Worktree and order when the person comes back to it.
 */
const states = new Map<string, GridState>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGridState(
  key: string,
): [GridState, (change: (state: GridState) => GridState) => void] {
  const state = useSyncExternalStore(subscribe, () => states.get(key) ?? NO_GRID_STATE);
  const update = useCallback(
    (change: (state: GridState) => GridState) => {
      const before = states.get(key) ?? NO_GRID_STATE;
      const after = change(before);
      if (after === before) return;
      states.set(key, after);
      listeners.forEach((listener) => listener());
    },
    [key],
  );
  return [state, update];
}
