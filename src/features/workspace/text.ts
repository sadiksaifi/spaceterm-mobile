import { cased } from "@/shared/text";

import type { TabAlert, TabFailure } from "./use-tab-commands";

export const text = {
  back: "Back",
  more: cased("More", "More options"),
  /** What TalkBack says for the check beside the active Worktree. */
  selected: "Selected",
  worktree: "Worktree",
  newWorktree: "New Worktree",
  renameWorkspace: "Rename Workspace",
  killWorkspace: "Kill Workspace",
  newTab: "New Tab",
  newPane: "New Pane",
  closeTab: "Close Tab",
  closePane: "Close Pane",
  moveTabLeft: cased("Move Tab Left", "Move Tab left"),
  moveTabRight: cased("Move Tab Right", "Move Tab right"),
  panes: "Panes",
  workspaces: "Workspaces",
  newWorkspace: "New Workspace",
  search: "Search",
  searchWorkspaces: "Search Workspaces",
  cancel: "Cancel",
  tryAgain: cased("Try Again", "Try again"),
  /** What screen readers say for the checked Workspace in the sheet. */
  current: "Current",
};

/** The alert that asks before a close, on both platforms. */
export function closeAlertText(alert: TabAlert): { title: string; body: string; action: string } {
  return alert.kind === "close-tab"
    ? {
        title: cased("Close This Tab?", "Close this Tab?"),
        body: sessionsBody(alert.tab.panes.length),
        action: text.closeTab,
      }
    : {
        title: cased("Close This Pane?", "Close this Pane?"),
        body: sessionsBody(1),
        action: text.closePane,
      };
}

/** One Terminal Session per Pane. */
function sessionsBody(sessions: number): string {
  return sessions === 1
    ? "This ends its Terminal Session."
    : `This ends its ${sessions} Terminal Sessions.`;
}

/** What a refused command did not do: an alert title on iOS, a snackbar on Android. */
export function failureText(failure: TabFailure): string {
  switch (failure.command) {
    case "close-tab":
      return cased("Couldn’t Close This Tab", "Couldn’t close this Tab");
    case "close-pane":
      return cased("Couldn’t Close This Pane", "Couldn’t close this Pane");
    case "new-tab":
      return cased("Couldn’t Open a New Tab", "Couldn’t open a new Tab");
    case "new-pane":
      return cased("Couldn’t Open a New Pane", "Couldn’t open a new Pane");
    case "move-tab":
      return cased("Couldn’t Move This Tab", "Couldn’t move this Tab");
    case "switch":
      return cased(
        `Couldn’t Switch to “${failure.worktree.name}”`,
        `Couldn’t switch to ${failure.worktree.name}`,
      );
  }
}
