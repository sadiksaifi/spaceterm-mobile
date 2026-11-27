import type { RowAlerts } from "@/features/home/row-alerts";
import type { WorkspaceRow } from "@/features/home/model";
import type { Tab } from "@/shared/machines/model";

import type { WorkspaceView } from "./model";
import type { Screens } from "./use-pane-previews";
import type { TabCommands } from "./use-tab-commands";

/** A Workspace of the bar, as its page shows it while it slides past the one on screen. */
export type WorkspacePage = {
  key: string;
  view: WorkspaceView;
  /** The Tabs its grid shows. */
  tabs: readonly Tab[];
  /** The last screens of its Panes, for the Workspaces beside the one on screen. */
  screens: Screens;
};

export type WorkspaceScreenProps = {
  view: Exclude<WorkspaceView, { kind: "gone" }>;
  /** The Workspaces Home lists, in its order, for the bar and the Workspaces sheet. */
  rows: readonly WorkspaceRow[];
  /** The Workspace on screen, as a row of Home, for its menu and alerts. */
  row: WorkspaceRow;
  /** One page per row of `rows`, in its order. The one on screen shows `view` and `commands`. */
  pages: readonly WorkspacePage[];
  commands: TabCommands;
  /** The last screens of the Panes the grid shows, by Pane. */
  screens: Screens;
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
