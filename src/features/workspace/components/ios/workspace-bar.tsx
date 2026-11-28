import { Button } from "@expo/ui/swift-ui";
import { disabled, frame } from "@expo/ui/swift-ui/modifiers";
import type { ComponentProps, ReactNode } from "react";

import { rowCommands, type Control, type RowCommands } from "@/features/home/actions";
import type { WorkspaceRow } from "@/features/home/model";
import type { RowAlerts } from "@/features/home/row-alerts";
import { PillBar, type BarButton, type PillAction } from "@/modules/pill-bar/swift-ui";

import type { WorktreeChoice } from "../../grid";
import { text } from "../../text";
import type { WorktreeMenu } from "../../worktree-menu";

/** The bar's metrics from the mockups. */
export const BAR_HEIGHT = 48;
const SIDE = 28;

/**
 * The Worktree menu at the left in a repository, the Workspaces Home lists as pills with the one
 * on screen highlighted, then Workspaces at the right. A tap or a drag of the highlight changes
 * Workspace; the pills scroll when they do not fit. Touch and hold a pill for the menu of its
 * Workspace row. The Workspace's content fills the screen under the bar and comes in from the side
 * of the pill it changed to.
 */
export function WorkspaceBar({
  rows,
  selected,
  alerts,
  bottom,
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
  /** Null outside a repository, where the pills take its room. */
  worktree: WorktreeMenu | null;
  /** The selected Workspace's content. */
  children: ReactNode;
  onSwitch: (row: WorkspaceRow) => void;
  onWorkspaces: () => void;
}) {
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
      leading={worktree === null ? undefined : worktreeButton(worktree)}
      trailing={{ systemImage: "rectangle.stack", label: text.workspaces, onPress: onWorkspaces }}
      onSelect={(key) => {
        const row = rows.find((each) => each.key === key);
        if (row !== undefined) onSwitch(row);
      }}
      onAction={(key, id) => {
        const controls = commands.get(key);
        const entry = MENU.find((each) => each.id === id);
        if (controls !== undefined && entry !== undefined) entry.control(controls).onPress?.();
      }}
      bottom={bottom}
      side={SIDE}
      modifiers={[frame({ maxWidth: FILL, maxHeight: FILL })]}
    >
      {children}
    </PillBar>
  );
}

const FILL = Number.POSITIVE_INFINITY;

/** The Worktree menu: New Worktree and Remove Worktree, then the Worktrees with the active one
 * checked. The actions come first: they have no check, so they line up with the edge. */
function worktreeButton(menu: WorktreeMenu): BarButton {
  const id = (choice: WorktreeChoice) => `worktree:${choice.worktree.path}`;
  return {
    systemImage: "arrow.triangle.branch",
    label: `${text.worktree}, ${menu.active.name}`,
    disabled: !menu.connected,
    menu: [
      {
        id: "new",
        label: text.newWorktree,
        systemImage: "plus",
        disabled: !menu.onNewWorktree,
      },
      {
        id: "remove",
        label: text.removeWorktree,
        systemImage: "trash",
        destructive: true,
        disabled: !menu.onRemoveWorktree,
      },
      ...menu.choices.map((choice, index) => ({
        id: id(choice),
        label: choice.worktree.name,
        checked: choice.active,
        divided: index === 0,
        disabled: !menu.connected,
      })),
    ],
    onAction: (action) => {
      if (action === "new") menu.onNewWorktree?.();
      else if (action === "remove") menu.onRemoveWorktree?.();
      else {
        // A choice made as the Machine disconnected can arrive after the disconnected render.
        const choice = menu.choices.find((each) => id(each) === action);
        if (choice !== undefined && menu.connected) menu.onPick(choice);
      }
    },
  };
}

/** A pill's menu: that of its Workspace row. */
const MENU: readonly (PillAction & { control: (commands: RowCommands) => Control })[] = [
  {
    id: "newTab",
    label: text.newTab,
    systemImage: "plus.square.on.square",
    control: (commands) => commands.newTab,
  },
  {
    id: "rename",
    label: text.renameWorkspace,
    systemImage: "pencil",
    control: (commands) => commands.rename,
  },
  {
    id: "kill",
    label: text.killWorkspace,
    systemImage: "xmark",
    destructive: true,
    divided: true,
    control: (commands) => commands.kill,
  },
];

export function menuItem(
  label: string,
  symbol: NonNullable<ComponentProps<typeof Button>["systemImage"]>,
  { onPress }: Control,
  destructive = false,
) {
  return (
    <Button
      label={label}
      systemImage={symbol}
      role={destructive ? "destructive" : undefined}
      onPress={onPress}
      modifiers={[disabled(!onPress)]}
    />
  );
}
