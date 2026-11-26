import { Host } from "@expo/ui";

import { useColors } from "@/shared/theme/colors";

import type { HomeActions } from "../../actions";
import type { HomeView } from "../../model";
import type { RowAlerts } from "../../row-alerts";
import { RowAlertsView } from "./row-alerts";
import { EmptyState } from "./states/empty-state";
import { WorkspaceList } from "./workspace-list";

/** The Workspace rows, or the state that takes their place. */
export function HomeContent({
  view,
  actions,
  alerts,
}: {
  view: HomeView;
  actions: HomeActions;
  alerts: RowAlerts;
}) {
  const colors = useColors();
  return (
    <Host style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
      <RowAlertsView alerts={alerts}>
        {view.kind === "workspaces" ? (
          <WorkspaceList
            rows={view.rows}
            onOpen={actions.onOpenWorkspace}
            handlers={alerts.handlers}
            underway={alerts.underway}
            onRefresh={actions.onRefresh}
          />
        ) : (
          <EmptyState view={view} actions={actions} />
        )}
      </RowAlertsView>
    </Host>
  );
}
