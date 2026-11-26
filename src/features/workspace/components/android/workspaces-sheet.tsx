import addIcon from "@expo/material-symbols/add.xml";
import checkIcon from "@expo/material-symbols/check.xml";
import deleteIcon from "@expo/material-symbols/delete.xml";
import searchIcon from "@expo/material-symbols/search.xml";
import {
  BasicTextField,
  Box,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  FloatingActionButton,
  Icon,
  ModalBottomSheet,
  Row,
  Surface,
  Text,
  useMaterialColors,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import {
  alpha,
  background,
  clip,
  combinedClickable,
  defaultMinSize,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  Shapes,
  size,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState, type ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { rowCommands, type Control } from "@/features/home/actions";
import type { WorkspaceRow } from "@/features/home/model";
import type { RowAlerts } from "@/features/home/row-alerts";
import { SwipeRow } from "@/modules/swipe-row";
import { connectionStateText } from "@/shared/machines/text";
import { useColors } from "@/shared/theme/colors";

import { text } from "../../text";

const FIELD_HEIGHT = 56;
/** Material gives a not connected row the disabled look. */
const DIMMED = 0.5;
const UNAVAILABLE = 0.38;
const ROW_CORNER = 28;
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
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const field = useNativeState("");
  const needle = query.trim().toLocaleLowerCase();
  const shown =
    needle === ""
      ? rows
      : rows.filter((row) => row.workspace.name.toLocaleLowerCase().includes(needle));

  return (
    <ModalBottomSheet onDismissRequest={onClose} containerColor={material.surfaceContainerLow}>
      <Box modifiers={[fillMaxWidth()]}>
        <Column modifiers={[fillMaxWidth(), padding(16, 0, 16, insets.bottom + 16)]}>
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 16 }}
            modifiers={[fillMaxWidth(), padding(0, 8, 0, 12)]}
          >
            <Surface
              color={material.surfaceContainerHigh}
              modifiers={[
                weight(1),
                height(FIELD_HEIGHT),
                clip(Shapes.RoundedCorner(FIELD_HEIGHT)),
              ]}
            >
              <Row
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 16 }}
                modifiers={[fillMaxSize(), padding(16, 0, 16, 0)]}
              >
                <Icon source={searchIcon} tint={colors.secondaryText} />
                <BasicTextField
                  value={field}
                  singleLine
                  onValueChange={setQuery}
                  textStyle={{ color: colors.text, fontSize: 16 }}
                  cursorColor={material.primary}
                  keyboardOptions={{ autoCorrectEnabled: false }}
                  modifiers={[weight(1)]}
                >
                  <BasicTextField.DecorationBox>
                    <Box>
                      <BasicTextField.Placeholder>
                        <Text style={{ typography: "bodyLarge" }} color={colors.secondaryText}>
                          {text.searchWorkspaces}
                        </Text>
                      </BasicTextField.Placeholder>
                      <BasicTextField.InnerTextField />
                    </Box>
                  </BasicTextField.DecorationBox>
                </BasicTextField>
              </Row>
            </Surface>
            <FloatingActionButton
              onClick={
                onNewWorkspace &&
                (() => {
                  onClose();
                  onNewWorkspace();
                })
              }
              containerColor={material.primaryContainer}
              modifiers={[
                size(FIELD_HEIGHT, FIELD_HEIGHT),
                clip(Shapes.Circle),
                ...(onNewWorkspace ? [] : [alpha(UNAVAILABLE)]),
              ]}
            >
              <FloatingActionButton.Icon>
                <Icon source={addIcon} contentDescription={text.newWorkspace} />
              </FloatingActionButton.Icon>
            </FloatingActionButton>
          </Row>
          <Column modifiers={[fillMaxWidth(), verticalScroll()]}>
            {shown.map((row) => (
              <SheetRow
                key={row.key}
                row={row}
                checked={row.key === selected}
                commands={rowCommands(row, alerts.handlers, alerts.underway.get(row.key) ?? null)}
                closedAlerts={alerts.closed}
                onPick={() => {
                  onClose();
                  onSwitch(row);
                }}
              />
            ))}
          </Column>
        </Column>
        {snackbar}
      </Box>
    </ModalBottomSheet>
  );
}

function SheetRow({
  row,
  checked,
  commands,
  closedAlerts,
  onPick,
}: {
  row: WorkspaceRow;
  checked: boolean;
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
  const fill = checked
    ? material.primaryContainer
    : held
      ? material.surfaceContainerHighest
      : // The sheet's own color, opaque, so the swipe's background shows only as the row moves.
        material.surfaceContainerLow;
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
              <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 12, 16, 12)]}>
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
