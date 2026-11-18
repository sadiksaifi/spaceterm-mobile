import { EMPTY_BOTTOM } from "@/shared/ui/android/state";

import type { HomeActions } from "../../actions";
import type { HomeView } from "../../model";
import type { RowAlerts } from "../../row-alerts";
import { EmptyState } from "./states/empty-state";
import { WorkspaceList } from "./workspace-list";

/** The Workspace rows, or the state that takes their place. */
export function HomeContent({
  view,
  actions,
  alerts,
  bottomPadding,
  emptyBottom = EMPTY_BOTTOM,
}: {
  view: HomeView;
  actions: HomeActions;
  alerts: RowAlerts;
  /** Space below the last row. */
  bottomPadding: number;
  /** Space an empty state keeps below itself. */
  emptyBottom?: number;
}) {
  if (view.kind === "workspaces") {
    return (
      <WorkspaceList
        rows={view.rows}
        onOpen={actions.onOpenWorkspace}
        alerts={alerts}
        bottomPadding={bottomPadding}
      />
    );
  }
  return <EmptyState view={view} actions={actions} bottom={emptyBottom} />;
}
