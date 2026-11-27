import type { RowAlerts } from "@/features/home/row-alerts";
import type { WorkspaceRow } from "@/features/home/model";

import type { WorkspaceView } from "./model";
import type { Screens } from "./use-pane-previews";
import type { RemoveWorktree } from "./use-remove-worktree";
import type { TabCommands } from "./use-tab-commands";

export type WorkspaceScreenProps = {
  view: Exclude<WorkspaceView, { kind: "gone" }>;
  /** The Workspaces Home lists, in its order, for the bar and the Workspaces sheet. */
  rows: readonly WorkspaceRow[];
  /** The Workspace on screen, as a row of Home, for its menu and alerts. */
  row: WorkspaceRow;
  commands: TabCommands;
  /** The last screens of the Panes the grid shows, by Pane. */
  screens: Screens;
  /** Rename Workspace and Kill Workspace, from the Workspace menu, the bar and the sheet. */
  alerts: RowAlerts;
  onBack: () => void;
  onSwitch: (row: WorkspaceRow) => void;
  /** Opens the Workspaces sheet, where iOS shows it as its own route. */
  onWorkspaces: () => void;
  /** Absent while no connected Machine can take a new Workspace. */
  onNewWorkspace: (() => void) | undefined;
  /** Absent outside a repository and while the Machine is not connected. */
  onNewWorktree: (() => void) | undefined;
  /** Remove Worktree, for the active Worktree, with its alerts. */
  removal: RemoveWorktree;
  onTryAgain: () => void;
  onMachineSettings: () => void;
};
