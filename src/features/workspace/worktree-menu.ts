import type { Worktree } from "@/shared/machines/model";

import type { WorktreeChoice } from "./grid";
import type { WorkspaceScreenProps } from "./props";

/** The Worktree menu at the bar's start: New Worktree, Remove Worktree, then the Worktrees. */
export type WorktreeMenu = {
  active: Worktree;
  choices: readonly WorktreeChoice[];
  /** A Workspace whose Machine is not connected shows the button without its menu. */
  connected: boolean;
  onPick: (choice: WorktreeChoice) => void;
  onNewWorktree: (() => void) | undefined;
  /** Absent for the Main Worktree and while a removal is under way. */
  onRemoveWorktree: (() => void) | undefined;
};

/**
 * The branch the header shows under the Workspace's name: the active Worktree's, or the branch the
 * Machine reports while it lists no Worktrees. Home rows leave the branch to this header.
 */
export function headerBranch(view: WorkspaceScreenProps["view"], menu: WorktreeMenu | null) {
  return menu?.active.name ?? view.workspace.branch ?? null;
}

/** The Worktree menu of a Workspace in a repository, or null outside one. */
export function worktreeMenu({
  view,
  commands,
  onNewWorktree,
  removal,
}: WorkspaceScreenProps): WorktreeMenu | null {
  const choices = view.workspace.repository === null ? [] : commands.grid.worktrees;
  const active = choices.find((choice) => choice.active);
  if (active === undefined) return null;
  return {
    active: active.worktree,
    choices,
    connected: view.kind === "tabs",
    onPick: ({ worktree }) => commands.pickWorktree(worktree),
    onNewWorktree,
    onRemoveWorktree: removal.start,
  };
}
