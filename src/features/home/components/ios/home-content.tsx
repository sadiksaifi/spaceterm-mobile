import { Host } from "@expo/ui";

import { useColors } from "@/shared/theme/colors";

import type { HomeActions } from "../../actions";
import type { HomeView } from "../../model";
import { EmptyState } from "./states/empty-state";
import { WorkspaceList } from "./workspace-list";

/** The Workspace rows, or the state that takes their place. */
export function HomeContent({ view, actions }: { view: HomeView; actions: HomeActions }) {
  const colors = useColors();
  return (
    <Host style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
      {view.kind === "workspaces" ? (
        <WorkspaceList rows={view.rows} onOpen={actions.onOpenWorkspace} />
      ) : (
        <EmptyState view={view} actions={actions} />
      )}
    </Host>
  );
}
