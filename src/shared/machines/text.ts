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

/**
 * Where an Invitation Link comes from, in the words No Machines and Add Machine share. The two
 * names are emphasized where the platform allows.
 */
export const inviteGuidance = [
  "Choose ",
  "Invite Device",
  " in SpaceTerm Desktop’s ",
  "Machines",
  " settings.",
] as const;

/** The other way to an Invitation Link. The command is set in a monospaced font where allowed. */
export const commandGuidance = ["Or run ", "spaceterm pair", " on your Machine."] as const;
