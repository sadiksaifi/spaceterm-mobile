import type { JSX } from "react";

import type { WorkspaceRow } from "@/features/home/model";
import type { RowAlerts } from "@/features/home/row-alerts";

export type WorkspacesScreenProps = {
  /** The Workspaces Search finds, in Home's order. */
  rows: readonly WorkspaceRow[];
  /** The row key of the Workspace under the sheet. */
  selected: string;
  /** Rename and Kill from a row's menu and swipe, shown over the sheet. */
  alerts: RowAlerts;
  onSearch: (query: string) => void;
  onPick: (row: WorkspaceRow) => void;
  /** Absent while no connected Machine can take a new Workspace. */
  onNewWorkspace: (() => void) | undefined;
  onClose: () => void;
};

/** Implemented per platform in `screen.ios.tsx` and `screen.android.tsx`. */
export default function WorkspacesScreen(props: WorkspacesScreenProps): JSX.Element | null;
