import type { UnreachableState } from "@/shared/machines/model";
import { cased } from "@/shared/text";

import type { RowCommand } from "./actions";

export const text = {
  title: "Workspaces",
  more: cased("More", "More options"),
  addMachine: "Add Machine",
  settings: "Settings",
  newWorkspace: "New Workspace",
  /** The iOS search field placeholder; the toolbar has no room for more. */
  search: "Search",
  searchWorkspaces: "Search Workspaces",
  /** The Android search's back and clear buttons. */
  back: "Back",
  clearText: "Clear text",
  loading: "Loading",
  /** What screen readers say for the spinner on a row whose command waits for its Machine. */
  underway: (command: RowCommand) => (command === "rename" ? "Renaming" : "Killing"),

  noMachines: "No Machines",
  scanQrCode: cased("Scan QR Code", "Scan QR code"),
  pasteInvitationLink: "Paste Invitation Link",
  getDesktop: "Get SpaceTerm Desktop",

  noWorkspaces: "No Workspaces",
  noWorkspacesBody: "Workspaces on your Machines appear here.",

  tryAgain: cased("Try Again", "Try again"),
  machineSettings: cased("Machine Settings", "Machine settings"),

  noResultsTitle: (query: string) => cased(`No Results for “${query}”`, `No results for ${query}`),
  noResultsBody: "Check the spelling or try a new search.",

  newTab: "New Tab",
  renameWorkspace: "Rename Workspace",
  killWorkspace: "Kill Workspace",
  cancel: "Cancel",
  rename: "Rename",
  /** The label of Rename Workspace's field. */
  name: "Name",
  /** iOS sets a name in an alert title in quotation marks; Android does not. */
  killTitle: (workspace: string) => cased(`Kill “${workspace}”?`, `Kill ${workspace}?`),
  /** The failure a refused command shows: an alert on iOS, a snackbar on Android. */
  failedTitle: (command: "rename" | "kill", workspace: string) =>
    command === "rename"
      ? cased(`Couldn’t Rename “${workspace}”`, `Couldn’t rename ${workspace}`)
      : cased(`Couldn’t Kill “${workspace}”`, `Couldn’t kill ${workspace}`),
};

/** The sentence under Kill Workspace's title: what is lost. `null` when nothing is running. */
export function killBody(terminalSessions: number): string | null {
  if (terminalSessions === 0) return null;
  const noun = terminalSessions === 1 ? "Terminal Session" : "Terminal Sessions";
  return `This ends its ${terminalSessions} ${noun}.`;
}

/** The title and sentence for a screen with nothing to list. `machine` is `null` for several Machines. */
export function unreachableText(
  state: UnreachableState,
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
