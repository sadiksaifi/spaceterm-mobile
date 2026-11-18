import { Platform } from "react-native";

import type { ConnectionState } from "./model";

/** Our words are the same on both platforms; only capitalization follows the platform. */
const cased = (titleCase: string, sentenceCase: string) =>
  Platform.OS === "ios" ? titleCase : sentenceCase;

export const DESKTOP_PROJECT_URL = "https://github.com/sadiksaifi/spaceterm";

export const text = {
  title: "Workspaces",
  more: cased("More", "More options"),
  addMachine: "Add Machine",
  settings: "Settings",
  newWorkspace: "New Workspace",
  searchWorkspaces: "Search Workspaces",
  loading: "Loading",

  noMachines: "No Machines",
  /** The sentence around the command, which is set in a monospaced font where the platform allows. */
  noMachinesBody: ["Run ", "spaceterm pair", " on your computer and scan its QR code."] as const,
  scanQrCode: cased("Scan QR Code", "Scan QR code"),
  pasteInvitationLink: "Paste Invitation Link",
  getDesktop: "Get SpaceTerm Desktop",

  noWorkspaces: "No Workspaces",
  noWorkspacesBody: "Workspaces on your Machines appear here.",

  tryAgain: cased("Try Again", "Try again"),
  machineSettings: cased("Machine Settings", "Machine settings"),

  noResultsTitle: (query: string) => cased(`No Results for “${query}”`, `No results for ${query}`),
  noResultsBody: "Check the spelling or try a new search.",
};

/** The title and sentence for a screen with nothing to list. `machine` is `null` for several Machines. */
export function unreachableText(
  state: Exclude<ConnectionState, "connected">,
  machine: string | null,
): { title: string; body?: string } {
  switch (state) {
    case "reconnecting":
      return { title: `Reconnecting to ${machine ?? "your Machines"}…` };
    case "still-not-connected":
      return {
        title: cased("Still Not Connected", "Still not connected"),
        body:
          machine === null
            ? "Make sure your Machines are on and SpaceTerm Core is running."
            : `Make sure ${machine} is on and SpaceTerm Core is running.`,
      };
    case "not-connected":
      return machine === null
        ? {
            title: cased("Machines Not Connected", "Machines not connected"),
            body: "Your Machines are not connected.",
          }
        : {
            title: cased("Machine Not Connected", "Machine not connected"),
            body: `${machine} is not connected.`,
          };
  }
}

/** The state a dimmed Workspace row shows in place of its directory. */
export function rowStateText(state: Exclude<ConnectionState, "connected">): string {
  switch (state) {
    case "reconnecting":
      return "Reconnecting…";
    case "still-not-connected":
      return cased("Still Not Connected", "Still not connected");
    case "not-connected":
      return cased("Not Connected", "Not connected");
  }
}
