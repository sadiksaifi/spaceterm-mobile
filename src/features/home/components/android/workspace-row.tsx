import branchIcon from "@expo/material-symbols/graph_1.xml";
import { Column, Icon, Row, Shape, Surface, Text } from "@expo/ui/jetpack-compose";
import { alpha, fillMaxWidth, padding, weight } from "@expo/ui/jetpack-compose/modifiers";

import { useColors } from "@/shared/theme/colors";

import type { HomeActions } from "../../actions";
import type { WorkspaceRow } from "../../model";
import { rowStateText } from "../../text";

/** Grouped cards: 16 outside corners, 4 inside. */
const OUTER_CORNER = 16;
const INNER_CORNER = 4;
/** Material gives a not connected row the disabled look. */
const DIMMED = 0.5;

export function WorkspaceRowView({
  row,
  first,
  last,
  onOpen,
}: {
  row: WorkspaceRow;
  first: boolean;
  last: boolean;
  onOpen: HomeActions["onOpenWorkspace"];
}) {
  const colors = useColors();
  const { workspace, connection } = row;
  const connected = connection === "connected";
  const top = first ? OUTER_CORNER : INNER_CORNER;
  const bottom = last ? OUTER_CORNER : INNER_CORNER;

  return (
    <Surface
      color={colors.groupedRow}
      contentColor={colors.text}
      shape={Shape.RoundedCorner({
        cornerRadii: { topStart: top, topEnd: top, bottomStart: bottom, bottomEnd: bottom },
      })}
      enabled={!!onOpen}
      onClick={() => onOpen?.(row)}
      modifiers={[fillMaxWidth(), ...(connected ? [] : [alpha(DIMMED)])]}
    >
      <Column
        verticalArrangement={{ spacedBy: 2 }}
        modifiers={[fillMaxWidth(), padding(16, 12, 16, 12)]}
      >
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
          <Text
            maxLines={1}
            overflow="ellipsis"
            style={{ typography: "bodyLarge" }}
            modifiers={[weight(1)]}
          >
            {workspace.name}
          </Text>
          <Text style={{ typography: "bodyMedium" }} color={colors.secondaryText}>
            {row.machineName}
          </Text>
        </Row>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
          <Text
            maxLines={1}
            overflow="ellipsis"
            style={{ typography: "bodyMedium" }}
            color={colors.secondaryText}
            modifiers={[weight(1)]}
          >
            {connected ? workspace.directory : rowStateText(connection)}
          </Text>
          {connected && workspace.branch !== undefined && (
            <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 4 }}>
              <Icon source={branchIcon} size={13} tint={colors.secondaryText} />
              <Text style={{ typography: "bodyMedium" }} color={colors.secondaryText}>
                {workspace.branch}
              </Text>
            </Row>
          )}
        </Row>
      </Column>
    </Surface>
  );
}
