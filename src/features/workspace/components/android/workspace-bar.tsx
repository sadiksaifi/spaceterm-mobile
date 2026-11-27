import addIcon from "@expo/material-symbols/add.xml";
import stacksIcon from "@expo/material-symbols/stacks.xml";
import {
  Box,
  FloatingActionButton,
  Icon,
  Surface,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import { alpha, clip, Shapes, size, type ModifierConfig } from "@expo/ui/jetpack-compose/modifiers";
import type { ReactNode } from "react";

import { rowCommands, type Control, type RowCommands } from "@/features/home/actions";
import type { WorkspaceRow } from "@/features/home/model";
import type { RowAlerts } from "@/features/home/row-alerts";
import { PillBar, type PillAction } from "@/modules/pill-bar/jetpack-compose";

import { text } from "../../text";

/** The bar's metrics from the mockups. */
export const BAR_HEIGHT = 56;
const SIDE = 16;
/** A FloatingActionButton has no disabled state; an unavailable one takes Material's disabled opacity. */
const UNAVAILABLE = 0.38;

/**
 * Workspaces at the left, the Workspaces Home lists as pills in the middle with the one on screen
 * on the indicator, and New Workspace at the right as the floating action button. A tap or a
 * sideways drag of the indicator changes Workspace; the pills scroll by themselves when they do
 * not fit. Touch and hold a pill for the menu of its Workspace row. The Workspace's content fills
 * the view under the bar and comes in from the side of the pill it changed to.
 */
export function WorkspaceBar({
  rows,
  selected,
  alerts,
  bottom,
  modifiers,
  children,
  onSwitch,
  onWorkspaces,
  onNewWorkspace,
}: {
  rows: readonly WorkspaceRow[];
  selected: string;
  alerts: RowAlerts;
  /** The bar's distance from the bottom edge. */
  bottom: number;
  modifiers?: ModifierConfig[];
  /** The selected Workspace's content. */
  children: ReactNode;
  onSwitch: (row: WorkspaceRow) => void;
  onWorkspaces: () => void;
  onNewWorkspace: (() => void) | undefined;
}) {
  const material = useMaterialColors();
  const commands = new Map(
    rows.map((row) => [
      row.key,
      rowCommands(row, alerts.handlers, alerts.underway.get(row.key) ?? null),
    ]),
  );
  const pills = rows.map((row) => {
    const controls = commands.get(row.key)!;
    const actions = MENU.map(({ control, ...entry }) => ({
      ...entry,
      disabled: !control(controls).onPress,
    }));
    return { key: row.key, name: row.workspace.name, actions };
  });

  return (
    <PillBar
      pills={pills}
      selected={selected}
      bottom={bottom}
      side={SIDE}
      modifiers={modifiers}
      onSelect={(key) => {
        const row = rows.find((each) => each.key === key);
        if (row !== undefined) onSwitch(row);
      }}
      onAction={(key, id) => {
        const controls = commands.get(key);
        const entry = MENU.find((each) => each.id === id);
        if (controls !== undefined && entry !== undefined) entry.control(controls).onPress?.();
      }}
    >
      <PillBar.Content>{children}</PillBar.Content>
      <PillBar.Leading>
        <Surface
          color={material.surfaceContainerHigh}
          onClick={onWorkspaces}
          modifiers={[size(BAR_HEIGHT, BAR_HEIGHT), clip(Shapes.Circle)]}
        >
          <Box contentAlignment="center" modifiers={[size(BAR_HEIGHT, BAR_HEIGHT)]}>
            <Icon source={stacksIcon} contentDescription={text.workspaces} />
          </Box>
        </Surface>
      </PillBar.Leading>
      <PillBar.Trailing>
        <FloatingActionButton
          onClick={onNewWorkspace}
          containerColor={material.primaryContainer}
          modifiers={[
            size(BAR_HEIGHT, BAR_HEIGHT),
            ...(onNewWorkspace ? [] : [alpha(UNAVAILABLE)]),
          ]}
        >
          <FloatingActionButton.Icon>
            <Icon source={addIcon} contentDescription={text.newWorkspace} />
          </FloatingActionButton.Icon>
        </FloatingActionButton>
      </PillBar.Trailing>
    </PillBar>
  );
}

/** A pill's menu: that of its Workspace row. No item is red. */
const MENU: readonly (PillAction & { control: (commands: RowCommands) => Control })[] = [
  { id: "newTab", label: text.newTab, control: (commands) => commands.newTab },
  { id: "rename", label: text.renameWorkspace, control: (commands) => commands.rename },
  {
    id: "kill",
    label: text.killWorkspace,
    divided: true,
    control: (commands) => commands.kill,
  },
];
