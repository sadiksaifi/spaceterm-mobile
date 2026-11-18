import { LazyColumn } from "@expo/ui/jetpack-compose";
import { fillMaxSize } from "@expo/ui/jetpack-compose/modifiers";

import type { HomeActions } from "../../actions";
import type { WorkspaceRow } from "../../model";
import { WorkspaceRowView } from "./workspace-row";

/** Space between the rows of a grouped card. */
const ROW_GAP = 2;

export function WorkspaceList({
  rows,
  onOpen,
  bottomPadding,
}: {
  rows: readonly WorkspaceRow[];
  onOpen: HomeActions["onOpenWorkspace"];
  bottomPadding: number;
}) {
  return (
    <LazyColumn
      verticalArrangement={{ spacedBy: ROW_GAP }}
      contentPadding={{ start: 16, end: 16, top: 16, bottom: bottomPadding }}
      modifiers={[fillMaxSize()]}
    >
      {rows.map((row, index) => (
        <WorkspaceRowView
          key={row.key}
          row={row}
          first={index === 0}
          last={index === rows.length - 1}
          onOpen={onOpen}
        />
      ))}
    </LazyColumn>
  );
}
