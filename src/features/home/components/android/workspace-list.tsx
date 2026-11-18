import { LazyColumn } from "@expo/ui/jetpack-compose";
import { fillMaxSize } from "@expo/ui/jetpack-compose/modifiers";

import { GROUPED_GAP } from "@/shared/ui/android/grouped";

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
}: {
  rows: readonly WorkspaceRow[];
  onOpen: HomeActions["onOpenWorkspace"];
  alerts: RowAlerts;
  bottomPadding: number;
}) {
  return (
    <LazyColumn
      verticalArrangement={{ spacedBy: GROUPED_GAP }}
      contentPadding={{ start: 16, end: 16, top: 16, bottom: bottomPadding }}
      modifiers={[fillMaxSize()]}
    >
      <LazyColumn.Items data={rows} keyExtractor={(row) => row.key} estimatedItemSize={ROW_HEIGHT}>
        {({ item, index }: { item: WorkspaceRow; index: number }) => (
          <WorkspaceRowView
            row={item}
            first={index === 0}
            last={index === rows.length - 1}
            commands={rowCommands(item, alerts.handlers)}
            closedAlerts={alerts.closed}
            onOpen={onOpen}
          />
        )}
      </LazyColumn.Items>
    </LazyColumn>
  );
}
