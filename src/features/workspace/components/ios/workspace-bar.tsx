import { Button, HStack, Image } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  disabled,
  font,
  frame,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import type { ComponentProps } from "react";

import { rowCommands, type Control, type RowCommands } from "@/features/home/actions";
import type { WorkspaceRow } from "@/features/home/model";
import type { RowAlerts } from "@/features/home/row-alerts";
import { PillBar, type PillAction } from "@/modules/pill-bar";

import { text } from "../../text";

/** The bar's metrics from the mockups. */
export const BAR_HEIGHT = 48;
const SIDE = 28;
const GAP = 12;

/**
 * The Workspaces Home lists as pills, with the one on screen highlighted, then Workspaces at the
 * right. A tap or a drag of the highlight changes Workspace; the pills scroll when they do not
 * fit. Touch and hold a pill for the menu of its Workspace row.
 */
export function WorkspaceBar({
  rows,
  selected,
  alerts,
  onSwitch,
  onWorkspaces,
}: {
  rows: readonly WorkspaceRow[];
  selected: string;
  alerts: RowAlerts;
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
    <HStack spacing={GAP} modifiers={[padding({ horizontal: SIDE })]}>
      <PillBar
        pills={pills}
        selected={selected}
        onSelect={(key) => {
          const row = rows.find((each) => each.key === key);
          if (row !== undefined) onSwitch(row);
        }}
        onAction={(key, id) => {
          const controls = commands.get(key);
          const entry = MENU.find((each) => each.id === id);
          if (controls !== undefined && entry !== undefined) entry.control(controls).onPress?.();
        }}
        modifiers={[
          frame({
            maxWidth: Number.POSITIVE_INFINITY,
            minHeight: BAR_HEIGHT,
            maxHeight: BAR_HEIGHT,
          }),
        ]}
      />
      <Button
        onPress={onWorkspaces}
        modifiers={[
          buttonStyle("glass"),
          buttonBorderShape("circle"),
          accessibilityLabel(text.workspaces),
        ]}
      >
        <Image
          systemName="rectangle.stack"
          modifiers={[
            font({ size: 20, weight: "medium" }),
            frame({ width: BAR_HEIGHT - 16, height: BAR_HEIGHT - 16 }),
          ]}
        />
      </Button>
    </HStack>
  );
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
