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

/** The header's title: the active Worktree, else the last folder of the Workspace's directory, as
 * a file browser titles a folder. The bar names the Workspace. */
export function headerTitle({ view }: WorkspaceScreenProps, worktree: WorktreeMenu | null): string {
  return worktree?.active.name ?? folderName(view.workspace.directory);
}

/** The last folder of `directory`: `build-logs` for `~/scratch/build-logs/`, `/` for `/`. */
export function folderName(directory: string): string {
  const parts = directory.split("/").filter((part) => part !== "");
  return parts.at(-1) ?? directory;
}
