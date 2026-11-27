import addIcon from "@expo/material-symbols/add.xml";
import stacksIcon from "@expo/material-symbols/stacks.xml";
import {
  Box,
  DropdownMenu,
  DropdownMenuItem,
  FloatingActionButton,
  Icon,
  Row,
  Surface,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  alpha,
  clip,
  combinedClickable,
  defaultMinSize,
  fillMaxHeight,
  offset,
  height,
  horizontalScroll,
  onSizeChanged,
  padding,
  Shapes,
  size,
  width,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";
import { useWindowDimensions } from "react-native";

import { rowCommands, type Control } from "@/features/home/actions";
import { fadingEdges, horizontalSwipe } from "@/modules/compose-modifiers";
import type { WorkspaceRow } from "@/features/home/model";
import type { RowAlerts } from "@/features/home/row-alerts";
import { useColors } from "@/shared/theme/colors";

import { barLayout } from "../../model";
import { text } from "../../text";
import { SWIPE_DISTANCE, swipedTo } from "../../use-bar-swipe";

/** The bar's metrics from the mockups. */
export const BAR_HEIGHT = 56;
const SIDE = 16;
const GAP = 8;
/** The selected Workspace's fill sits this far inside the bar. */
const INSET = 8;
/** Room on each side of a name. */
const PADDING = 20;
/** An edge with Workspaces past it fades over this width. */
const FADE = 14;
/** A FloatingActionButton has no disabled state; an unavailable one takes Material's disabled opacity. */
const UNAVAILABLE = 0.38;
const MENU_CORNER = 16;
const MENU_ELEVATION = 3;
const MENU_WIDTH = 196;

/**
 * Workspaces at the left, the Workspaces Home lists in the middle, New Workspace at the right as
 * the floating action button. The middle is never scrolled by hand: a swipe along the bar changes
 * Workspace, and the middle moves by itself to keep the selected Workspace in view.
 */
export function WorkspaceBar({
  rows,
  selected,
  alerts,
  onSwitch,
  onWorkspaces,
  onNewWorkspace,
}: {
  rows: readonly WorkspaceRow[];
  selected: string;
  alerts: RowAlerts;
  onSwitch: (row: WorkspaceRow) => void;
  onWorkspaces: () => void;
  onNewWorkspace: (() => void) | undefined;
}) {
  const material = useMaterialColors();
  const { width: window } = useWindowDimensions();
  const [names, setNames] = useState<ReadonlyMap<string, number>>(new Map());
  const middle = window - 2 * SIDE - 2 * BAR_HEIGHT - 2 * GAP;
  const inner = middle - 2 * INSET;
  const at = rows.findIndex((row) => row.key === selected);
  const layout = barLayout(
    rows.map((row) => names.get(row.key)),
    inner,
    at,
    PADDING,
  );
  const starts = layout.widths.map((_, index) =>
    layout.widths.slice(0, index).reduce((sum, each) => sum + each, 0),
  );

  return (
    <Row
      verticalAlignment="center"
      horizontalArrangement={{ spacedBy: GAP }}
      modifiers={[
        padding(SIDE, 0, SIDE, 0),
        horizontalSwipe(SWIPE_DISTANCE, (direction) => {
          const next = swipedTo(rows, selected, direction);
          if (next !== undefined) onSwitch(next);
        }),
      ]}
    >
      <Surface
        color={material.surfaceContainerHigh}
        onClick={onWorkspaces}
        modifiers={[size(BAR_HEIGHT, BAR_HEIGHT), clip(Shapes.Circle)]}
      >
        <Box contentAlignment="center" modifiers={[size(BAR_HEIGHT, BAR_HEIGHT)]}>
          <Icon source={stacksIcon} contentDescription={text.workspaces} />
        </Box>
      </Surface>
      <Surface
        color={material.surfaceContainerHigh}
        modifiers={[size(middle, BAR_HEIGHT), clip(Shapes.RoundedCorner(BAR_HEIGHT / 2))]}
      >
        <Box modifiers={[padding(INSET, INSET, INSET, INSET)]}>
          {/* Measures each name at its own width; it takes no height, so it shows nothing. */}
          <Row modifiers={[height(0), horizontalScroll()]}>
            {rows.map((row) => (
              <Text
                key={row.key}
                maxLines={1}
                style={{ typography: "bodyLarge" }}
                modifiers={[
                  onSizeChanged(({ width: measured }) =>
                    setNames((known) =>
                      known.get(row.key) === measured
                        ? known
                        : new Map(known).set(row.key, measured),
                    ),
                  ),
                ]}
              >
                {row.workspace.name}
              </Text>
            ))}
          </Row>
          <Box
            modifiers={[
              size(inner, BAR_HEIGHT - 2 * INSET),
              clip(Shapes.RoundedCorner(BAR_HEIGHT)),
              fadingEdges({
                left: layout.past.start ? FADE : 0,
                right: layout.past.end ? FADE : 0,
              }),
            ]}
          >
            {rows.map((row, index) => (
              <Pill
                key={row.key}
                row={row}
                x={(starts[index] ?? 0) - layout.offset}
                width={layout.widths[index] ?? 0}
                selected={row.key === selected}
                alerts={alerts}
                onPress={() => onSwitch(row)}
              />
            ))}
          </Box>
        </Box>
      </Surface>
      <FloatingActionButton
        onClick={onNewWorkspace}
        containerColor={material.primaryContainer}
        modifiers={[size(BAR_HEIGHT, BAR_HEIGHT), ...(onNewWorkspace ? [] : [alpha(UNAVAILABLE)])]}
      >
        <FloatingActionButton.Icon>
          <Icon source={addIcon} contentDescription={text.newWorkspace} />
        </FloatingActionButton.Icon>
      </FloatingActionButton>
    </Row>
  );
}

/** A Workspace in the bar. Touch and hold opens the menu of a Workspace row at it. */
function Pill({
  row,
  x,
  width: pillWidth,
  selected,
  alerts,
  onPress,
}: {
  row: WorkspaceRow;
  x: number;
  width: number;
  selected: boolean;
  alerts: RowAlerts;
  onPress: () => void;
}) {
  const colors = useColors();
  const material = useMaterialColors();
  const [held, setHeld] = useState(false);
  const commands = rowCommands(row, alerts.handlers, alerts.underway.get(row.key) ?? null);
  const item = (label: string, { onPress: run }: Control) => (
    <DropdownMenuItem
      enabled={!!run}
      modifiers={[defaultMinSize({ minWidth: MENU_WIDTH })]}
      onClick={() => {
        setHeld(false);
        run?.();
      }}
    >
      <DropdownMenuItem.Text>
        <Text>{label}</Text>
      </DropdownMenuItem.Text>
    </DropdownMenuItem>
  );

  return (
    <Box modifiers={[width(pillWidth), fillMaxHeight(), offset(x, 0)]}>
      <DropdownMenu
        expanded={held}
        onDismissRequest={() => setHeld(false)}
        color={material.surfaceContainerHigh}
        cornerRadius={MENU_CORNER}
        shadowElevation={MENU_ELEVATION}
      >
        <DropdownMenu.Trigger>
          <Surface
            color={selected ? material.primaryContainer : "#00000000"}
            contentColor={selected ? material.onPrimaryContainer : colors.secondaryText}
            modifiers={[
              width(pillWidth),
              fillMaxHeight(),
              clip(Shapes.RoundedCorner(BAR_HEIGHT)),
              combinedClickable({ onClick: onPress, onLongClick: () => setHeld(true) }),
            ]}
          >
            <Box contentAlignment="center" modifiers={[width(pillWidth), fillMaxHeight()]}>
              <Text maxLines={1} overflow="ellipsis" style={{ typography: "bodyLarge" }}>
                {row.workspace.name}
              </Text>
            </Box>
          </Surface>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {item(text.newTab, commands.newTab)}
          {item(text.renameWorkspace, commands.rename)}
          {item(text.killWorkspace, commands.kill)}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Box>
  );
}
