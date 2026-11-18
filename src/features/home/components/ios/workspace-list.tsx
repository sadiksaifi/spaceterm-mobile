import { List, Section } from "@expo/ui/swift-ui";
import { listStyle, scrollDismissesKeyboard } from "@expo/ui/swift-ui/modifiers";
import { useCallback } from "react";

import type { HomeActions } from "../../actions";
import type { WorkspaceRow } from "../../model";
import { WorkspaceRowView } from "./workspace-row";

export function WorkspaceList({
  rows,
  onOpen,
}: {
  rows: readonly WorkspaceRow[];
  onOpen: HomeActions["onOpenWorkspace"];
}) {
  const renderRow = useCallback(
    ({ item }: { item: WorkspaceRow }) => <WorkspaceRowView row={item} onOpen={onOpen} />,
    [onOpen],
  );

  return (
    <List modifiers={[listStyle("insetGrouped"), scrollDismissesKeyboard("interactively")]}>
      <Section>
        <List.ForEach data={rows} keyExtractor={(row) => row.key}>
          {renderRow}
        </List.ForEach>
      </Section>
    </List>
  );
}
