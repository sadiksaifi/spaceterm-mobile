import { List, Section } from "@expo/ui/swift-ui";
import { listStyle, scrollDismissesKeyboard } from "@expo/ui/swift-ui/modifiers";

import { rowCommands, type HomeActions, type RowCommand, type RowHandlers } from "../../actions";
import type { WorkspaceRow } from "../../model";
import { WorkspaceRowView } from "./workspace-row";

export function WorkspaceList({
  rows,
  onOpen,
  handlers,
  underway,
}: {
  rows: readonly WorkspaceRow[];
  onOpen: HomeActions["onOpenWorkspace"];
  handlers: RowHandlers;
  /** The command under way on each row, by row key. */
  underway: ReadonlyMap<string, RowCommand>;
}) {
  return (
    <List modifiers={[listStyle("insetGrouped"), scrollDismissesKeyboard("interactively")]}>
      <Section>
        <List.ForEach data={rows} keyExtractor={(row) => row.key}>
          {({ item }: { item: WorkspaceRow }) => (
            <WorkspaceRowView
              row={item}
              commands={rowCommands(item, handlers, underway.get(item.key) ?? null)}
              onOpen={onOpen}
            />
          )}
        </List.ForEach>
      </Section>
    </List>
  );
}
