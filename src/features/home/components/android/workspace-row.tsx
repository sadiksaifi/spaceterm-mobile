import deleteIcon from "@expo/material-symbols/delete.xml";
import {
  Box,
  CircularProgressIndicator,
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
  semantics,
  Shapes,
  size,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";

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
/** Side by side, the Machine takes at most this share of the line; the name takes the rest. */
const DETAIL_SHARE = 0.6;
/** The touch and hold menu, as wide as the design draws it. */
const MENU_WIDTH = 220;
const MENU_CORNER = 16;
const MENU_ELEVATION = 3;
/** How far a row's text fades while its command waits for the Machine. */
const UNDERWAY_ALPHA = 0.45;
const SPINNER_SIZE = 20;
const SPINNER_STROKE = 2;

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
  const { workspace, connection } = row;
  const connected = connection === "connected";
  const { underway } = commands;
  const shape = groupedCorners(first, last);
  // Side by side, the name takes the space the Machine leaves.
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
    >
      {connected ? workspace.directory : connectionStateText(connection)}
    </Text>
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
        // A row whose command waits for the Machine takes no input until the answer.
        ...(underway === null
          ? [
              combinedClickable({
                onClick: onOpen && (() => onOpen(row.machineId, workspace.id)),
                onLongClick: () => setHeld(true),
              }),
            ]
          : []),
        ...(connected ? [] : [alpha(DIMMED)]),
      ]}
    >
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 12 }}
        modifiers={[fillMaxWidth(), padding(16, 12, 16, 12)]}
      >
        <Column
          verticalArrangement={{ spacedBy: 2 }}
          modifiers={[weight(1), ...(underway === null ? [] : [alpha(UNDERWAY_ALPHA)])]}
        >
          {largeText ? (
            <>
              {name}
              {machine}
              {directory}
            </>
          ) : (
            <>
              <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
                {name}
                {machine}
              </Row>
              {directory}
            </>
          )}
        </Column>
        {underway !== null && (
          <CircularProgressIndicator
            color={material.primary}
            strokeWidth={SPINNER_STROKE}
            modifiers={[
              size(SPINNER_SIZE, SPINNER_SIZE),
              semantics({ contentDescription: text.underway(underway) }),
            ]}
          />
        )}
      </Row>
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
