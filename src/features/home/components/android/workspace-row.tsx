import branchIcon from "@expo/material-symbols/graph_1.xml";
import { Column, Icon, Row, Shape, Surface, Text } from "@expo/ui/jetpack-compose";
import { alpha, fillMaxWidth, padding, weight } from "@expo/ui/jetpack-compose/modifiers";
import { useWindowDimensions } from "react-native";

import { maxWidthFraction } from "@/modules/compose-modifiers";
import { useColors } from "@/shared/theme/colors";

import type { HomeActions } from "../../actions";
import { useLargeText } from "../../large-text";
import type { WorkspaceRow } from "../../model";
import { rowStateText } from "../../text";

/** Grouped cards: 16 outside corners, 4 inside. */
const OUTER_CORNER = 16;
const INNER_CORNER = 4;
/** Material gives a not connected row the disabled look. */
const DIMMED = 0.5;
/** The branch icon matches the bodyMedium text beside it, so it grows with the font scale. */
const BRANCH_ICON = 13;
/** Side by side, the Machine and branch leave at least this share of the line to the name and directory. */
const DETAIL_SHARE = 0.6;

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
  const largeText = useLargeText();
  const { fontScale } = useWindowDimensions();
  const { workspace, connection } = row;
  const connected = connection === "connected";
  const top = first ? OUTER_CORNER : INNER_CORNER;
  const bottom = last ? OUTER_CORNER : INNER_CORNER;
  // Side by side, the name and the directory take the space the Machine and branch leave.
  const fill = largeText ? [] : [weight(1)];
  const detail = largeText ? [] : [maxWidthFraction(DETAIL_SHARE)];
  // Side by side, each part keeps to one line. Stacked, each part wraps to show all of it.
  const maxLines = largeText ? undefined : 1;

  const name = (
    <Text
      maxLines={maxLines}
      overflow="ellipsis"
      style={{ typography: "bodyLarge" }}
      modifiers={fill}
    >
      {workspace.name}
    </Text>
  );
  const machine = (
    <Text
      maxLines={maxLines}
      overflow="ellipsis"
      style={{ typography: "bodyMedium" }}
      color={colors.secondaryText}
      modifiers={detail}
    >
      {row.machineName}
    </Text>
  );
  const directory = (
    <Text
      maxLines={maxLines}
      overflow="ellipsis"
      style={{ typography: "bodyMedium" }}
      color={colors.secondaryText}
      modifiers={fill}
    >
      {connected ? workspace.directory : rowStateText(connection)}
    </Text>
  );
  const branch = connected && workspace.branch !== undefined && (
    <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 4 }} modifiers={detail}>
      <Icon source={branchIcon} size={BRANCH_ICON * fontScale} tint={colors.secondaryText} />
      <Text
        maxLines={maxLines}
        overflow="ellipsis"
        style={{ typography: "bodyMedium" }}
        color={colors.secondaryText}
      >
        {workspace.branch}
      </Text>
    </Row>
  );

  return (
    <Surface
      color={colors.groupedRow}
      contentColor={colors.text}
      shape={Shape.RoundedCorner({
        cornerRadii: { topStart: top, topEnd: top, bottomStart: bottom, bottomEnd: bottom },
      })}
      enabled={!!onOpen}
      onClick={() => onOpen?.(row.machineId, workspace.id)}
      modifiers={[fillMaxWidth(), ...(connected ? [] : [alpha(DIMMED)])]}
    >
      <Column
        verticalArrangement={{ spacedBy: 2 }}
        modifiers={[fillMaxWidth(), padding(16, 12, 16, 12)]}
      >
        {largeText ? (
          <>
            {name}
            {machine}
            {directory}
            {branch}
          </>
        ) : (
          <>
            <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
              {name}
              {machine}
            </Row>
            <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
              {directory}
              {branch}
            </Row>
          </>
        )}
      </Column>
    </Surface>
  );
}
