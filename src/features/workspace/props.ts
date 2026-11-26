import type { RowAlerts } from "@/features/home/row-alerts";
import type { WorkspaceRow } from "@/features/home/model";

import type { WorkspaceView } from "./model";
import type { TabCommands } from "./use-tab-commands";

export type WorkspaceScreenProps = {
  view: Exclude<WorkspaceView, { kind: "gone" }>;
  /** The Workspaces Home lists, in its order, for the bar and the Workspaces sheet. */
  rows: readonly WorkspaceRow[];
  /** The Workspace on screen, as a row of Home, for its menu and alerts. */
  row: WorkspaceRow;
  commands: TabCommands;
  /** Rename Workspace and Kill Workspace, from the Workspace menu, the bar and the sheet. */
  alerts: RowAlerts;
  onBack: () => void;
  onSwitch: (row: WorkspaceRow) => void;
  /** Absent while no connected Machine can take a new Workspace. */
  onNewWorkspace: (() => void) | undefined;
  /** Absent outside a repository and while the Machine is not connected. */
  onNewWorktree: (() => void) | undefined;
  onTryAgain: () => void;
  onMachineSettings: () => void;
};
