import {
  Button,
  ContextMenu,
  Divider,
  HStack,
  Image,
  Spacer,
  SwipeActions,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  disabled,
  font,
  foregroundStyle,
  labelStyle,
  lineLimit,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { Color } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import type { ColorValue } from "react-native";

import { connectionStateText } from "@/shared/machines/text";
import { useColors } from "@/shared/theme/colors";
import { secondary } from "@/shared/ui/ios/modifiers";
import { useLargeText } from "@/shared/ui/large-text";

import type { Control, HomeActions, RowCommands } from "../../actions";
import type { WorkspaceRow } from "../../model";
import { text } from "../../text";

const detailFont = font({ textStyle: "subheadline" });

export function WorkspaceRowView({
  row,
  commands,
  onOpen,
}: {
  row: WorkspaceRow;
  commands: RowCommands;
  onOpen: HomeActions["onOpenWorkspace"];
}) {
  const colors = useColors();
  const largeText = useLargeText();
  const { workspace, connection } = row;
  const connected = connection === "connected";
  // Side by side, each part keeps to one line. Stacked, each part wraps to show all of it.
  const oneLine = largeText ? [] : [lineLimit(1)];

  const name = (
    <Text
      modifiers={[
        font({ textStyle: "headline" }),
        foregroundStyle({ type: "hierarchical", style: connected ? "primary" : "secondary" }),
        ...oneLine,
      ]}
    >
      {workspace.name}
    </Text>
  );
  const machine = <Text modifiers={[detailFont, secondary, ...oneLine]}>{row.machineName}</Text>;
  const directory = (
    <Text modifiers={[detailFont, secondary, ...oneLine]}>
      {connected ? workspace.directory : connectionStateText(connection)}
    </Text>
  );
  const branch = connected && workspace.branch !== undefined && (
    <HStack spacing={3}>
      <Image
        systemName="arrow.triangle.branch"
        modifiers={[font({ textStyle: "caption" }), secondary, accessibilityHidden()]}
      />
      <Text modifiers={[detailFont, secondary, ...oneLine]}>{workspace.branch}</Text>
    </HStack>
  );

  const button = (
    <Button onPress={() => onOpen?.(row.machineId, workspace.id)} modifiers={[disabled(!onOpen)]}>
      {/* A Button in a List tints its label. The row reads as text, so it starts from the text color. */}
      <HStack spacing={10} modifiers={[foregroundStyle({ type: "color", color: colors.text })]}>
        {largeText ? (
          <VStack alignment="leading" spacing={2}>
            {name}
            {machine}
            {directory}
            {branch}
          </VStack>
        ) : (
          <VStack alignment="leading" spacing={2}>
            <Line start={name} end={machine} alignment="firstTextBaseline" />
            <Line start={directory} end={branch} />
          </VStack>
        )}
        {largeText && <Spacer />}
        <Image
          systemName="chevron.forward"
          modifiers={[
            font({ textStyle: "footnote", weight: "semibold" }),
            foregroundStyle({ type: "hierarchical", style: "tertiary" }),
            accessibilityHidden(),
          ]}
        />
      </HStack>
    </Button>
  );

  // Touch and hold dims the screen and shows the menu beside the lit row.
  const withMenu = (
    <ContextMenu>
      <ContextMenu.Items>
        {menuItem(text.newTab, "plus.square.on.square", commands.newTab)}
        {menuItem(text.renameWorkspace, "pencil", commands.rename)}
        <Divider />
        {menuItem(text.killWorkspace, "xmark", commands.kill, true)}
      </ContextMenu.Items>
      <ContextMenu.Trigger>{button}</ContextMenu.Trigger>
    </ContextMenu>
  );
  if (!commands.swipes) return withMenu;

  // The trailing swipe shows two circles with no words. The first, Kill Workspace, sits at the
  // edge and runs on a full swipe; it asks first, so it is tinted red rather than destructive,
  // which would take the row away before the answer.
  return (
    <SwipeActions>
      {withMenu}
      <SwipeActions.Actions edge="trailing">
        {swipeButton(text.killWorkspace, "xmark", commands.kill, Color.ios.systemRed)}
        {swipeButton(text.renameWorkspace, "pencil", commands.rename, Color.ios.systemGray)}
      </SwipeActions.Actions>
    </SwipeActions>
  );
}

type SymbolName = NonNullable<ComponentProps<typeof Button>["systemImage"]>;

function menuItem(label: string, symbol: SymbolName, { onPress }: Control, destructive = false) {
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

function swipeButton(label: string, symbol: SymbolName, { onPress }: Control, color: ColorValue) {
  return (
    <Button
      label={label}
      systemImage={symbol}
      onPress={onPress}
      modifiers={[labelStyle("iconOnly"), tint(color)]}
    />
  );
}

/**
 * Two parts at the ends of a line. Neither is fixed in size, so when both are long they share
 * the line and each truncates; a short part keeps its whole width.
 */
function Line({
  start,
  end,
  alignment,
}: {
  start: ReactNode;
  end: ReactNode;
  alignment?: "firstTextBaseline";
}) {
  return (
    <HStack spacing={0} alignment={alignment}>
      {start}
      <Spacer minLength={8} />
      {end}
    </HStack>
  );
}
