import { LazyColumn } from "@expo/ui/jetpack-compose";
import { fillMaxSize } from "@expo/ui/jetpack-compose/modifiers";

import { GROUPED_GAP } from "@/shared/ui/android/grouped";
import { Refreshable } from "@/shared/ui/android/refreshable";

import { rowCommands, type HomeActions } from "../../actions";
import type { WorkspaceRow } from "../../model";
import type { RowAlerts } from "../../row-alerts";
import { WorkspaceRowView } from "./workspace-row";

/** A row's height at the default font scale, for rows not measured yet. */
const ROW_HEIGHT = 68;

export function WorkspaceList({
  rows,
  onOpen,
  alerts,
  bottomPadding,
  onRefresh,
}: {
  rows: readonly WorkspaceRow[];
  onOpen: HomeActions["onOpenWorkspace"];
  alerts: RowAlerts;
  bottomPadding: number;
  onRefresh: HomeActions["onRefresh"];
}) {
  return (
    <Refreshable onRefresh={onRefresh}>
      <LazyColumn
        verticalArrangement={{ spacedBy: GROUPED_GAP }}
        contentPadding={{ start: 16, end: 16, top: 16, bottom: bottomPadding }}
        modifiers={[fillMaxSize()]}
      >
        <LazyColumn.Items
          data={rows}
          keyExtractor={(row) => row.key}
          estimatedItemSize={ROW_HEIGHT}
        >
          {({ item, index }: { item: WorkspaceRow; index: number }) => (
            // The list reuses a row's slot for another Workspace; the key gives that one fresh state,
            // so a menu open on one row never moves to the next.
            <WorkspaceRowView
              key={item.key}
              row={item}
              first={index === 0}
              last={index === rows.length - 1}
              commands={rowCommands(item, alerts.handlers, alerts.underway.get(item.key) ?? null)}
              closedAlerts={alerts.closed}
              onOpen={onOpen}
            />
          )}
        </LazyColumn.Items>
      </LazyColumn>
    </Refreshable>
  );
}
