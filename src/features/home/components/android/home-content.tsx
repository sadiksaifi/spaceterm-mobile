import { Refreshable } from "@/shared/ui/android/refreshable";

import type { HomeActions } from "../../actions";
import type { HomeView } from "../../model";
import type { RowAlerts } from "../../row-alerts";
import { EMPTY_BOTTOM, EmptyState } from "./states/empty-state";
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
        onRefresh={actions.onRefresh}
      />
    );
  }
  const empty = <EmptyState view={view} actions={actions} bottom={emptyBottom} />;
  // An empty list pulls to refresh as the list does. Unreachable has Try Again in its place.
  return view.kind === "no-workspaces" || view.kind === "no-results" ? (
    <Refreshable onRefresh={actions.onRefresh}>{empty}</Refreshable>
  ) : (
    empty
  );
}
