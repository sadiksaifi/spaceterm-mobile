import type { HomeActions } from "../../actions";
import type { HomeView } from "../../model";
import { EMPTY_BOTTOM } from "@/shared/ui/android/state";
import { EmptyState } from "./states/empty-state";
import { WorkspaceList } from "./workspace-list";

/** The Workspace rows, or the state that takes their place. */
export function HomeContent({
  view,
  actions,
  bottomPadding,
  emptyBottom = EMPTY_BOTTOM,
}: {
  view: HomeView;
  actions: HomeActions;
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
        bottomPadding={bottomPadding}
      />
    );
  }
  return <EmptyState view={view} actions={actions} bottom={emptyBottom} />;
}
