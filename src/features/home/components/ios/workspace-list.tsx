import { List, Section } from "@expo/ui/swift-ui";
import { listStyle, scrollDismissesKeyboard } from "@expo/ui/swift-ui/modifiers";

import { rowCommands, type HomeActions, type RowHandlers } from "../../actions";
import type { WorkspaceRow } from "../../model";
import { WorkspaceRowView } from "./workspace-row";

export function WorkspaceList({
  rows,
  onOpen,
  handlers,
}: {
  rows: readonly WorkspaceRow[];
  onOpen: HomeActions["onOpenWorkspace"];
  handlers: RowHandlers;
}) {
  return (
    <List modifiers={[listStyle("insetGrouped"), scrollDismissesKeyboard("interactively")]}>
      <Section>
        <List.ForEach data={rows} keyExtractor={(row) => row.key}>
          {({ item }: { item: WorkspaceRow }) => (
            <WorkspaceRowView row={item} commands={rowCommands(item, handlers)} onOpen={onOpen} />
          )}
        </List.ForEach>
      </Section>
    </List>
  );
}
