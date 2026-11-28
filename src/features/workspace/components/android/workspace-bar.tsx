import stacksIcon from "@expo/material-symbols/stacks.xml";
import { FilledIconButton, Icon, useMaterialColors } from "@expo/ui/jetpack-compose";
import { size, type ModifierConfig } from "@expo/ui/jetpack-compose/modifiers";
import type { ReactNode } from "react";

import { rowCommands, type Control, type RowCommands } from "@/features/home/actions";
import type { WorkspaceRow } from "@/features/home/model";
import type { RowAlerts } from "@/features/home/row-alerts";
import { PillBar, type PillAction } from "@/modules/pill-bar/jetpack-compose";

import { text } from "../../text";
import type { WorktreeMenu } from "../../worktree-menu";
import { WorktreeButton } from "./worktree-button";

/** The bar's metrics from the mockups. */
export const BAR_HEIGHT = 56;
const SIDE = 16;

/**
 * The Worktree menu at the left in a repository, the Workspaces Home lists as pills in the middle
 * with the one on screen on the indicator, and Workspaces at the right. A tap or a sideways drag of
 * the indicator changes Workspace; the pills scroll by themselves when they do not fit. Touch and
 * hold a pill for the menu of its Workspace row. The Workspace's content fills the view under the
 * bar and comes in from the side of the pill it changed to.
 */
export function WorkspaceBar({
  rows,
  selected,
  alerts,
  bottom,
  modifiers,
  worktree,
  children,
  onSwitch,
  onWorkspaces,
}: {
  rows: readonly WorkspaceRow[];
  selected: string;
  alerts: RowAlerts;
  /** The bar's distance from the bottom edge. */
  bottom: number;
  modifiers?: ModifierConfig[];
  /** Null outside a repository, where the pills take its room. */
  worktree: WorktreeMenu | null;
  /** The selected Workspace's content. */
  children: ReactNode;
  onSwitch: (row: WorkspaceRow) => void;
  onWorkspaces: () => void;
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
      {worktree !== null && (
        <PillBar.Leading>
          <WorktreeButton menu={worktree} diameter={BAR_HEIGHT} />
        </PillBar.Leading>
      )}
      <PillBar.Trailing>
        <FilledIconButton
          onClick={onWorkspaces}
          colors={{
            containerColor: material.surfaceContainerHigh,
            contentColor: material.onSurface,
          }}
          modifiers={[size(BAR_HEIGHT, BAR_HEIGHT)]}
        >
          <Icon source={stacksIcon} contentDescription={text.workspaces} />
        </FilledIconButton>
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
