import addIcon from "@expo/material-symbols/add.xml";
import notConnectedIcon from "@expo/material-symbols/desktop_access_disabled.xml";
import machineIcon from "@expo/material-symbols/desktop_windows.xml";
import { Column, Icon, Row, Slider, Switch, Text } from "@expo/ui/jetpack-compose";
import {
  background,
  fillMaxSize,
  fillMaxWidth,
  padding,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PrivacySetting } from "@/shared/preferences/model";
import { FONT_SIZE } from "@/shared/preferences/store";
import { useColors } from "@/shared/theme/colors";
import { GROUPED_GAP } from "@/shared/ui/android/grouped";
import { GroupedRow, GroupHeader } from "@/shared/ui/android/grouped-row";
import { ScreenHost } from "@/shared/ui/android/screen-host";

import { Gap, GROUP_SPACE, PageTopBar } from "./components/android/page";
import type ScreenContract from "./screen";
import type { SettingsProps } from "./screen";
import { machineStatus, text } from "./text";

const PRIVACY: readonly { setting: PrivacySetting; label: string }[] = [
  { setting: "notifications", label: text.notifications },
  { setting: "terminalAttention", label: text.terminalAttention },
  { setting: "programsCopyText", label: text.programsCopyText },
  { setting: "programsReadClipboard", label: text.programsReadClipboard },
];

export default function SettingsScreen({
  machines,
  themeName,
  fontSize,
  privacy,
  onOpenMachine,
  onAddMachine,
  onOpenThemes,
  onFontSize,
  onPrivacy,
}: SettingsProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHost>
        <Column modifiers={[fillMaxSize(), background(colors.groupedBackground)]}>
          <PageTopBar title={text.title} />
          <Column
            verticalArrangement={{ spacedBy: GROUPED_GAP }}
            modifiers={[
              weight(1),
              verticalScroll(),
              padding(16, 0, 16, insets.bottom + GROUP_SPACE),
            ]}
          >
            <GroupHeader>{text.machines}</GroupHeader>
            {machines.map((machine, index) => (
              <GroupedRow
                key={machine.id}
                first={index === 0}
                last={false}
                leading={
                  <Icon
                    source={machine.connection === "connected" ? machineIcon : notConnectedIcon}
                    tint={colors.secondaryText}
                  />
                }
                headline={machine.name}
                supporting={machineStatus(machine.connection)}
                onClick={() => onOpenMachine(machine.id)}
              />
            ))}
            <GroupedRow
              first={machines.length === 0}
              last
              leading={<Icon source={addIcon} tint={colors.secondaryText} />}
              headline={text.addMachine}
              onClick={onAddMachine}
            />

            <Gap />
            <GroupedRow
              first
              last={false}
              headline={text.themes}
              supporting={themeName}
              onClick={onOpenThemes}
            />
            <GroupedRow
              first={false}
              last
              headline={
                <Row verticalAlignment="center">
                  <Text modifiers={[weight(1)]}>{text.fontSize}</Text>
                  <Text color={colors.secondaryText}>{text.points(fontSize)}</Text>
                </Row>
              }
              supporting={
                <Slider
                  value={fontSize}
                  min={FONT_SIZE.min}
                  max={FONT_SIZE.max}
                  // The stops between the ends, one a point.
                  steps={FONT_SIZE.max - FONT_SIZE.min - 1}
                  onValueChange={(value) => onFontSize(Math.round(value))}
                  modifiers={[fillMaxWidth()]}
                />
              }
            />

            <GroupHeader>{text.privacy}</GroupHeader>
            {PRIVACY.map(({ setting, label }, index) => (
              <GroupedRow
                key={setting}
                first={index === 0}
                last={index === PRIVACY.length - 1}
                headline={label}
                trailing={
                  <Switch
                    value={privacy[setting]}
                    onCheckedChange={(on) => onPrivacy(setting, on)}
                  />
                }
                onClick={() => onPrivacy(setting, !privacy[setting])}
              />
            ))}
          </Column>
        </Column>
      </ScreenHost>
    </>
  );
}

SettingsScreen satisfies typeof ScreenContract;
