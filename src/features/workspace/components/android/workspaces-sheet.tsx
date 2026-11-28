import addIcon from "@expo/material-symbols/add.xml";
import checkIcon from "@expo/material-symbols/check.xml";
import deleteIcon from "@expo/material-symbols/delete.xml";
import {
  Box,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  ModalBottomSheet,
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
  imePadding,
  padding,
  Shapes,
  size,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState, type ReactNode } from "react";
import type { ColorValue } from "react-native";

import { rowCommands, type Control } from "@/features/home/actions";
import type { WorkspaceRow } from "@/features/home/model";
import type { RowAlerts } from "@/features/home/row-alerts";
import { SearchBar } from "@/modules/search-bar";
import { SwipeRow } from "@/modules/swipe-row";
import { connectionStateText } from "@/shared/machines/text";
import { useColors } from "@/shared/theme/colors";

import { text } from "../../text";

/** Below the content; the sheet keeps clear of the navigation bar itself. */
const SHEET_BOTTOM = 16;
const FIELD_HEIGHT = 56;
/** Material gives a not connected row the disabled look. */
const DIMMED = 0.5;
const UNAVAILABLE = 0.38;
const ROW_CORNER = 16;
const ROW_HEIGHT = 64;
const MENU_CORNER = 16;
const MENU_ELEVATION = 3;
const MENU_WIDTH = 196;

/**
 * Search and New Workspace, then the Workspaces Home lists, with the one on screen filled and
 * checked. Picking a Workspace closes the sheet on its Tabs.
 */
export function WorkspacesSheet({
  onClose,
  rows,
  selected,
  alerts,
  onSwitch,
  onNewWorkspace,
  snackbar,
}: {
  onClose: () => void;
  rows: readonly WorkspaceRow[];
  selected: string;
  alerts: RowAlerts;
  onSwitch: (row: WorkspaceRow) => void;
  onNewWorkspace: (() => void) | undefined;
  /** The screen's snackbar, which shows here while the sheet covers the screen. */
  snackbar: ReactNode;
}) {
  const material = useMaterialColors();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const needle = query.trim().toLocaleLowerCase();
  const shown =
    needle === ""
      ? rows
      : rows.filter((row) => row.workspace.name.toLocaleLowerCase().includes(needle));
  const list = (
    listed: readonly WorkspaceRow[],
    rest: ColorValue,
    inset: ReturnType<typeof padding> | undefined,
  ) => (
    <Column
      verticalArrangement={{ spacedBy: 2 }}
      modifiers={[fillMaxWidth(), verticalScroll(), ...(inset ? [inset] : [])]}
    >
      {listed.map((row) => (
        <SheetRow
          key={row.key}
          row={row}
          checked={row.key === selected}
          rest={rest}
          commands={rowCommands(row, alerts.handlers, alerts.underway.get(row.key) ?? null)}
          closedAlerts={alerts.closed}
          onPick={() => {
            onClose();
            onSwitch(row);
          }}
        />
      ))}
    </Column>
  );

  return (
    <ModalBottomSheet
      onDismissRequest={onClose}
      containerColor={material.surfaceContainerLow}
      skipPartiallyExpanded
      // The only keyboard is the full-screen search's. Material would grow the sheet under it and
      // learn it closed only after it slid away, so the search would collapse to a raised bar.
      keyboardInsets={false}
    >
      <Box modifiers={[fillMaxWidth()]}>
        <Column modifiers={[fillMaxWidth(), padding(16, 0, 16, SHEET_BOTTOM)]}>
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 8 }}
            modifiers={[fillMaxWidth(), padding(0, 0, 0, 12)]}
          >
            {/* Material's search: the pill opens a full-screen search of the Workspaces. */}
            <SearchBar
              onQueryChange={setQuery}
              onExpandedChange={setSearching}
              backLabel={text.back}
              clearLabel={text.clearText}
              modifiers={[weight(1)]}
            >
              <SearchBar.Placeholder>
                <Text>{text.searchWorkspaces}</Text>
              </SearchBar.Placeholder>
              <SearchBar.Results>
                {/* Results sit above the keyboard. */}
                <Box modifiers={[fillMaxSize(), imePadding()]}>
                  {list(shown, material.surface, padding(16, 8, 16, SHEET_BOTTOM))}
                  {searching && snackbar}
                </Box>
              </SearchBar.Results>
            </SearchBar>
            {/* A surface, not a floating action button, so an unavailable one is disabled for
                TalkBack too. */}
            <Surface
              color={material.primaryContainer}
              contentColor={material.onPrimaryContainer}
              enabled={!!onNewWorkspace}
              onClick={() => {
                if (!onNewWorkspace) return;
                onClose();
                onNewWorkspace();
              }}
              modifiers={[
                size(FIELD_HEIGHT, FIELD_HEIGHT),
                clip(Shapes.Circle),
                ...(onNewWorkspace ? [] : [alpha(UNAVAILABLE)]),
              ]}
            >
              <Box contentAlignment="center" modifiers={[size(FIELD_HEIGHT, FIELD_HEIGHT)]}>
                <Icon source={addIcon} contentDescription={text.newWorkspace} />
              </Box>
            </Surface>
          </Row>
          {list(rows, material.surfaceContainerLow, undefined)}
        </Column>
        {!searching && snackbar}
      </Box>
    </ModalBottomSheet>
  );
}

function SheetRow({
  row,
  checked,
  rest,
  commands,
  closedAlerts,
  onPick,
}: {
  row: WorkspaceRow;
  checked: boolean;
  /** The color behind the list, opaque, so the swipe's background shows only as the row moves. */
  rest: ColorValue;
  commands: ReturnType<typeof rowCommands>;
  closedAlerts: number;
  onPick: () => void;
}) {
  const material = useMaterialColors();
  const colors = useColors();
  const [held, setHeld] = useState(false);
  const { connection } = row;
  const detail =
    connection === "connected"
      ? row.machineName
      : `${row.machineName} · ${connectionStateText(connection)}`;
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
  const fill = checked ? material.primaryContainer : held ? material.surfaceContainerHighest : rest;
  const content = checked ? material.onPrimaryContainer : colors.text;

  return (
    <SwipeRow enabled={commands.swipes} onSwipe={commands.kill.onPress} resetToken={closedAlerts}>
      {commands.swipes && (
        <SwipeRow.Background>
          <Box
            contentAlignment="centerEnd"
            modifiers={[
              fillMaxSize(),
              // A point inside the row's edge, so its smoothed corners don't show the color.
              padding(1, 1, 1, 1),
              clip(Shapes.RoundedCorner(ROW_CORNER)),
              background(material.errorContainer),
              padding(0, 0, 32, 0),
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
          <DropdownMenu.Trigger>
            <Surface
              color={fill}
              contentColor={content}
              modifiers={[
                fillMaxWidth(),
                clip(Shapes.RoundedCorner(ROW_CORNER)),
                ...(commands.underway === null
                  ? [combinedClickable({ onClick: onPick, onLongClick: () => setHeld(true) })]
                  : []),
                ...(connection === "connected" ? [] : [alpha(DIMMED)]),
              ]}
            >
              <Row
                verticalAlignment="center"
                modifiers={[
                  fillMaxWidth(),
                  defaultMinSize({ minHeight: ROW_HEIGHT }),
                  padding(16, 8, 16, 8),
                ]}
              >
                <Column modifiers={[weight(1)]}>
                  <Text maxLines={1} overflow="ellipsis" style={{ typography: "bodyLarge" }}>
                    {row.workspace.name}
                  </Text>
                  <Text
                    maxLines={1}
                    overflow="ellipsis"
                    style={{ typography: "bodyMedium" }}
                    color={checked ? material.onPrimaryContainer : colors.secondaryText}
                  >
                    {detail}
                  </Text>
                </Column>
                {checked && <Icon source={checkIcon} contentDescription={text.current} />}
              </Row>
            </Surface>
          </DropdownMenu.Trigger>
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
