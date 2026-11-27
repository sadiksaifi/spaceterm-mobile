import type { WorktreeRemovalFailure } from "@/shared/machines/model";
import { cased } from "@/shared/text";

import type { RemovalAlert } from "./use-remove-worktree";
import type { TabAlert, TabFailure } from "./use-tab-commands";

export const text = {
  back: "Back",
  more: cased("More", "More options"),
  /** What TalkBack says for the check beside the active Worktree. */
  selected: "Selected",
  worktree: "Worktree",
  newWorktree: "New Worktree",
  removeWorktree: "Remove Worktree",
  ok: "OK",
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
  cancelSearch: cased("Cancel Search", "Cancel search"),
  searchWorkspaces: "Search Workspaces",
  clearText: "Clear text",
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

/**
 * Remove Worktree's alert: what it deletes on `machine` and what it closes, to confirm, or why
 * nothing was removed. `action` is the confirming button's, absent on a failure that leaves
 * nothing to do; `destructive` when it removes.
 */
export function removalAlertText(
  alert: RemovalAlert,
  machine: string,
): { title: string; body: string; action?: string; destructive?: boolean } {
  if (alert.kind === "confirm") {
    const { worktree, changes, submodules, tabs, sessions } = alert.review;
    const deleted =
      changes && submodules
        ? ", including uncommitted changes, untracked files, and submodule directories."
        : changes
          ? ", including uncommitted changes and untracked files."
          : submodules
            ? ", including submodule directories."
            : ".";
    const closed =
      tabs === 0
        ? ""
        : ` Closes ${count(tabs, "Tab")} for every device.` +
          (sessions === 0 ? "" : ` Ends ${count(sessions, "Terminal Session")}.`);
    return {
      title: cased(`Remove Worktree “${worktree.name}”?`, `Remove Worktree ${worktree.name}?`),
      body: `Deletes its directory on “${machine}”${deleted}${closed}`,
      action: changes
        ? cased("Remove and Discard Changes", "Remove and discard changes")
        : "Remove",
      destructive: true,
    };
  }
  const { worktree, failure, checking } = alert;

  if (failure === "interrupted") {
    return {
      title: "Check the Worktree",
      body: "SpaceTerm Core stopped before it confirmed the result. Check the Worktrees before trying again.",
    };
  }
  if (failure === "failed") {
    return checking
      ? {
          title: cased("Couldn’t Check Worktree Changes", "Couldn’t check Worktree changes"),
          body: "Try again before removing the Worktree.",
        }
      : {
          // Git deletes the checkout before its own records, so a failure may leave part of it.
          title: "Check the Worktree",
          body: "The Machine didn’t finish removing it. Its Tabs may have closed, and Git may have deleted part of it. Check the Worktrees before trying again.",
        };
  }
  if (failure === "unanswered") {
    return {
      title: "Check the Worktree",
      body: "The Machine didn’t answer, so it may have removed the Worktree. Try again to find out.",
      action: text.tryAgain,
    };
  }
  return {
    title: cased(`Couldn’t Remove “${worktree.name}”`, `Couldn’t remove ${worktree.name}`),
    body: removalFailureBody[failure],
  };
}

/** The failures whose alert says the Worktree was not removed. */
const removalFailureBody: Record<
  Exclude<WorktreeRemovalFailure, "interrupted" | "unanswered" | "failed">,
  string
> = {
  main: "The Main Worktree can’t be removed.",
  locked: "Unlock the Worktree with Git before removing it.",
  pinned: "Unpin the directory before removing it.",
  missing: "Another device or Git removed it.",
  changed:
    "Nothing was removed. Review the updated Worktree and Terminal Sessions before removing it.",
  "changed-after-closing":
    "Git kept the Worktree because it changed after its Tabs closed and their Terminal Sessions ended. Review it before removing it.",
};

/** `1 Tab`, `2 Tabs`. */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
