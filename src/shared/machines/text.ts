import { cased } from "../text";
import type { UnreachableState } from "./model";

/** What a dimmed row says about a Machine that is not connected. */
export function connectionStateText(state: UnreachableState): string {
  switch (state) {
    case "reconnecting":
      return "Reconnecting…";
    case "still-not-connected":
      return cased("Still Not Connected", "Still not connected");
    case "not-connected":
      return cased("Not Connected", "Not connected");
  }
}
