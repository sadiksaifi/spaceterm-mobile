import deleteIcon from "@expo/material-symbols/delete.xml";
import branchIcon from "@expo/material-symbols/graph_1.xml";
import {
  Box,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  Row,
  Surface,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  alpha,
  background,
  clip,
  combinedClickable,
  defaultMinSize,
  fillMaxSize,
  fillMaxWidth,
  padding,
  Shapes,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";
import { useWindowDimensions } from "react-native";

import { maxWidthFraction } from "@/modules/compose-modifiers";
import { SwipeRow } from "@/modules/swipe-row";
import { connectionStateText } from "@/shared/machines/text";
import { useColors } from "@/shared/theme/colors";
import { groupedCorners } from "@/shared/ui/android/grouped";
import { useLargeText } from "@/shared/ui/large-text";

import type { Control, HomeActions, RowCommands } from "../../actions";
import type { WorkspaceRow } from "../../model";
import { text } from "../../text";

/** Material gives a not connected row the disabled look. */
const DIMMED = 0.5;
/** The branch icon matches the bodyMedium text beside it, so it grows with the font scale. */
const BRANCH_ICON = 13;
/** Side by side, the Machine and branch leave at least this share of the line to the name and directory. */
const DETAIL_SHARE = 0.6;
/** The touch and hold menu, as wide as the design draws it. */
const MENU_WIDTH = 220;
const MENU_CORNER = 16;
const MENU_ELEVATION = 3;

export function WorkspaceRowView({
  row,
  first,
  last,
  commands,
  closedAlerts,
  onOpen,
}: {
  row: WorkspaceRow;
  first: boolean;
  last: boolean;
  commands: RowCommands;
  /** Grows each time a row alert closes, which puts a swiped row back. */
  closedAlerts: number;
  onOpen: HomeActions["onOpenWorkspace"];
}) {
  const colors = useColors();
  const material = useMaterialColors();
  const [held, setHeld] = useState(false);
  const largeText = useLargeText();
  const { fontScale } = useWindowDimensions();
  const { workspace, connection } = row;
  const connected = connection === "connected";
  const shape = groupedCorners(first, last);
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
      {connected ? workspace.directory : connectionStateText(connection)}
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

  const item = (label: string, { onPress }: Control) => (
    <DropdownMenuItem
      enabled={!!onPress}
      modifiers={[defaultMinSize({ minWidth: MENU_WIDTH })]}
      onClick={() => {
        setHeld(false);
        onPress?.();
      }}
    >
      <DropdownMenuItem.Text>
        <Text>{label}</Text>
      </DropdownMenuItem.Text>
    </DropdownMenuItem>
  );

  // Touch and hold opens the menu at the row with no dimming; the held row takes a higher tone.
  const card = (
    <Surface
      color={held ? material.surfaceContainerHighest : colors.groupedRow}
      contentColor={colors.text}
      modifiers={[
        fillMaxWidth(),
        clip(Shapes.RoundedCorner(shape)),
        combinedClickable({
          onClick: onOpen && (() => onOpen(row.machineId, workspace.id)),
          onLongClick: () => setHeld(true),
        }),
        ...(connected ? [] : [alpha(DIMMED)]),
      ]}
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

  // The trailing swipe shows the error color and the delete icon behind the row. Letting go
  // asks to kill the Workspace; Cancel puts the row back.
  return (
    <SwipeRow enabled={commands.swipes} onSwipe={commands.kill.onPress} resetToken={closedAlerts}>
      {/* A row that cannot swipe is dimmed, and would show the error color through it. */}
      {commands.swipes && (
        <SwipeRow.Background>
          <Box
            contentAlignment="centerEnd"
            modifiers={[
              fillMaxSize(),
              clip(Shapes.RoundedCorner(shape)),
              background(material.errorContainer),
              padding(0, 0, 40, 0),
            ]}
          >
            <Icon
              source={deleteIcon}
              tint={material.onErrorContainer}
              contentDescription={text.killWorkspace}
            />
          </Box>
        </SwipeRow.Background>
      )}
      <SwipeRow.Content>
        <DropdownMenu
          expanded={held}
          onDismissRequest={() => setHeld(false)}
          color={material.surfaceContainerHigh}
          cornerRadius={MENU_CORNER}
          shadowElevation={MENU_ELEVATION}
        >
          <DropdownMenu.Trigger>{card}</DropdownMenu.Trigger>
          <DropdownMenu.Items>
            {item(text.newTab, commands.newTab)}
            {item(text.renameWorkspace, commands.rename)}
            {item(text.killWorkspace, commands.kill)}
          </DropdownMenu.Items>
        </DropdownMenu>
      </SwipeRow.Content>
    </SwipeRow>
  );
}
