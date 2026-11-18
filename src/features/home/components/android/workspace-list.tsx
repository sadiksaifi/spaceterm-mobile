import { LazyColumn } from "@expo/ui/jetpack-compose";
import { fillMaxSize } from "@expo/ui/jetpack-compose/modifiers";
import { useCallback } from "react";

import type { HomeActions } from "../../actions";
import type { WorkspaceRow } from "../../model";
import { WorkspaceRowView } from "./workspace-row";

/** Space between the rows of a grouped card. */
const ROW_GAP = 2;
/** A row's height at the default font scale, for rows not measured yet. */
const ROW_HEIGHT = 68;

export function WorkspaceList({
  rows,
  onOpen,
  bottomPadding,
}: {
  rows: readonly WorkspaceRow[];
  onOpen: HomeActions["onOpenWorkspace"];
  bottomPadding: number;
}) {
  const renderRow = useCallback(
    ({ item, index }: { item: WorkspaceRow; index: number }) => (
      <WorkspaceRowView
        row={item}
        first={index === 0}
        last={index === rows.length - 1}
        onOpen={onOpen}
      />
    ),
    [rows.length, onOpen],
  );

  return (
    <LazyColumn
      verticalArrangement={{ spacedBy: ROW_GAP }}
      contentPadding={{ start: 16, end: 16, top: 16, bottom: bottomPadding }}
      modifiers={[fillMaxSize()]}
    >
      <LazyColumn.Items data={rows} keyExtractor={(row) => row.key} estimatedItemSize={ROW_HEIGHT}>
        {renderRow}
      </LazyColumn.Items>
    </LazyColumn>
  );
}
