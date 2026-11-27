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
  accessibilityLabel,
  disabled,
  font,
  foregroundStyle,
  labelStyle,
  lineLimit,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { Color } from "expo-router";
import type { ColorValue } from "react-native";

import { rowCommands, type Control } from "@/features/home/actions";
import type { WorkspaceRow } from "@/features/home/model";
import { connectionStateText } from "@/shared/machines/text";
import { useColors } from "@/shared/theme/colors";
import { secondary } from "@/shared/ui/ios/modifiers";

import { menuItem } from "../../../components/ios/workspace-bar";
import { text } from "../../../text";

/**
 * A Workspace in the sheet: its name and Machine, checked when it is the one under the sheet. Its
 * menu and swipe are those of Home's rows.
 */
export function WorkspaceRowView({
  row,
  checked,
  commands,
  onPick,
}: {
  row: WorkspaceRow;
  checked: boolean;
  commands: ReturnType<typeof rowCommands>;
  onPick: () => void;
}) {
  const colors = useColors();
  const { connection } = row;
  const connected = connection === "connected";
  const detail =
    connection === "connected"
      ? row.machineName
      : `${row.machineName} · ${connectionStateText(connection)}`;
  const button = (
    <Button onPress={onPick} modifiers={[disabled(commands.underway !== null)]}>
      <HStack spacing={8} modifiers={[foregroundStyle({ type: "color", color: colors.text })]}>
        <VStack alignment="leading" spacing={2}>
          <Text
            modifiers={[
              font({ textStyle: "headline" }),
              lineLimit(1),
              ...(connected ? [] : [secondary]),
            ]}
          >
            {row.workspace.name}
          </Text>
          <Text modifiers={[font({ textStyle: "subheadline" }), secondary, lineLimit(1)]}>
            {detail}
          </Text>
        </VStack>
        <Spacer minLength={8} />
        {checked && (
          <Image
            systemName="checkmark"
            modifiers={[
              font({ weight: "semibold" }),
              foregroundStyle({ type: "color", color: colors.tint }),
              accessibilityLabel(text.current),
            ]}
          />
        )}
      </HStack>
    </Button>
  );
  if (commands.underway !== null) return button;
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
  // As on Home: two circles with no words; a full swipe is Kill Workspace, which asks first.
  return (
    <SwipeActions>
      {withMenu}
      <SwipeActions.Actions edge="trailing">
        {swipeButton(text.killWorkspace, "xmark", commands.kill, Color.ios.systemRed)}
        {swipeButton(text.renameWorkspace, "pencil", commands.rename)}
      </SwipeActions.Actions>
    </SwipeActions>
  );
}

function swipeButton(
  label: string,
  symbol: "xmark" | "pencil",
  { onPress }: Control,
  color?: ColorValue,
) {
  return (
    <Button
      label={label}
      systemImage={symbol}
      onPress={onPress}
      modifiers={[labelStyle("iconOnly"), ...(color === undefined ? [] : [tint(color)])]}
    />
  );
}
