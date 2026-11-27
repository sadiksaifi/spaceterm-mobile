import { Button, ContextMenu, Divider, HStack, Image, Text, ZStack } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityHidden,
  accessibilityLabel,
  animation,
  Animation,
  background,
  buttonBorderShape,
  buttonStyle,
  clipShape,
  contentShape,
  disabled,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  glassEffect,
  lineLimit,
  offset,
  onGeometryChange,
  opacity,
  padding,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { Color } from "expo-router";
import { useState, type ComponentProps } from "react";
import { useWindowDimensions } from "react-native";

import { rowCommands, type Control } from "@/features/home/actions";
import type { WorkspaceRow } from "@/features/home/model";
import type { RowAlerts } from "@/features/home/row-alerts";
import { fadingEdges, useHorizontalSwipe } from "@/modules/swift-ui-modifiers";

import { barLayout } from "../../model";
import { SWIPE_DISTANCE, swipedTo } from "../../bar-swipe";
import { text } from "../../text";

/** The bar's metrics from the mockups. */
export const BAR_HEIGHT = 48;
const SIDE = 28;
const GAP = 12;
/** The selected Workspace's fill sits this far inside the bar. */
const INSET = 6;
/** Room on each side of a name. */
const PADDING = 16;
/** An edge with Workspaces past it fades over this width. */
const FADE = 14;

/**
 * Workspaces at the left, the Workspaces Home lists in the middle, New Workspace at the right.
 * The middle is never scrolled by hand: a swipe along the bar changes Workspace, and the middle
 * moves by itself to keep the selected Workspace in view.
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

  const swipe = useHorizontalSwipe(SWIPE_DISTANCE, (direction) => {
    const next = swipedTo(rows, selected, direction);
    if (next !== undefined) onSwitch(next);
  });

  return (
    <HStack spacing={GAP} modifiers={[padding({ horizontal: SIDE }), swipe]}>
      <Circle symbol="square.stack" label={text.workspaces} onPress={onWorkspaces} />
      <ZStack
        alignment="leading"
        modifiers={[
          frame({ width: middle, height: BAR_HEIGHT }),
          glassEffect({ glass: { variant: "regular" }, shape: "capsule" }),
        ]}
      >
        <ZStack
          alignment="leading"
          modifiers={[
            // Leading, so the offset counts from the first name, however wide the row is.
            frame({ width: inner, height: BAR_HEIGHT - 2 * INSET, alignment: "leading" }),
            clipShape("capsule"),
            // Clipping hides the names past the edges but leaves them tappable; this stops that.
            contentShape(shapes.capsule()),
            fadingEdges({
              start: layout.past.start ? FADE : 0,
              end: layout.past.end ? FADE : 0,
            }),
          ]}
        >
          <HStack
            spacing={0}
            modifiers={[
              fixedSize({ horizontal: true }),
              offset({ x: -layout.offset }),
              animation(Animation.default, layout.offset),
            ]}
          >
            {rows.map((row, index) => (
              <Pill
                key={row.key}
                row={row}
                width={layout.widths[index] ?? 0}
                selected={row.key === selected}
                alerts={alerts}
                onPress={() => onSwitch(row)}
                onMeasure={(width) =>
                  setNames((known) =>
                    known.get(row.key) === width ? known : new Map(known).set(row.key, width),
                  )
                }
              />
            ))}
          </HStack>
        </ZStack>
      </ZStack>
      <Circle symbol="plus" label={text.newWorkspace} onPress={onNewWorkspace} />
    </HStack>
  );
}

type SymbolName = NonNullable<ComponentProps<typeof Image>["systemName"]>;

function Circle({
  symbol,
  label,
  onPress,
}: {
  symbol: SymbolName;
  label: string;
  onPress: (() => void) | undefined;
}) {
  return (
    <Button
      onPress={onPress}
      modifiers={[
        buttonStyle("glass"),
        buttonBorderShape("circle"),
        disabled(!onPress),
        accessibilityLabel(label),
      ]}
    >
      <Image
        systemName={symbol}
        modifiers={[
          font({ size: 20, weight: "medium" }),
          frame({ width: BAR_HEIGHT - 16, height: BAR_HEIGHT - 16 }),
        ]}
      />
    </Button>
  );
}

/** A Workspace in the bar. Touch and hold opens the menu of a Workspace row. */
function Pill({
  row,
  width,
  selected,
  alerts,
  onPress,
  onMeasure,
}: {
  row: WorkspaceRow;
  width: number;
  selected: boolean;
  alerts: RowAlerts;
  onPress: () => void;
  onMeasure: (width: number) => void;
}) {
  const commands = rowCommands(row, alerts.handlers, alerts.underway.get(row.key) ?? null);
  const pill = (
    <Button
      onPress={onPress}
      modifiers={[
        buttonStyle("plain"),
        ...(selected ? [accessibilityAddTraits(["isSelected"])] : []),
      ]}
    >
      <ZStack
        modifiers={[
          frame({ width, height: BAR_HEIGHT - 2 * INSET }),
          ...(selected ? [background(Color.ios.tertiarySystemFill, shapes.capsule())] : []),
        ]}
      >
        {/* The whole name, unseen, measures the room it asks for. */}
        <Text
          modifiers={[
            font({ textStyle: "body" }),
            lineLimit(1),
            fixedSize({ horizontal: true }),
            opacity(0),
            accessibilityHidden(true),
            onGeometryChange((frame) => onMeasure(frame.width)),
          ]}
        >
          {row.workspace.name}
        </Text>
        <Text
          modifiers={[
            font({ textStyle: "body" }),
            lineLimit(1),
            frame({ maxWidth: Math.max(width - 2 * PADDING, 0) }),
            foregroundStyle({ type: "hierarchical", style: selected ? "primary" : "secondary" }),
          ]}
        >
          {row.workspace.name}
        </Text>
      </ZStack>
    </Button>
  );
  return (
    <ContextMenu>
      <ContextMenu.Items>
        {menuItem(text.newTab, "plus.square.on.square", commands.newTab)}
        {menuItem(text.renameWorkspace, "pencil", commands.rename)}
        <Divider />
        {menuItem(text.killWorkspace, "xmark", commands.kill, true)}
      </ContextMenu.Items>
      <ContextMenu.Trigger>{pill}</ContextMenu.Trigger>
    </ContextMenu>
  );
}

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
