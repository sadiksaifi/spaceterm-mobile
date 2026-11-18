import type { HomeSnapshot } from "./model";

const NO_MACHINES: HomeSnapshot = { machines: [], starting: false };

/** What this device knows about its Machines. Until pairing exists, it knows none. */
export function useHomeSnapshot(): HomeSnapshot {
  return NO_MACHINES;
}
