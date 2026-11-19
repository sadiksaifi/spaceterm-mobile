import { Host } from "@expo/ui";
import {
  Button,
  HStack,
  Image,
  List,
  Section,
  Spacer,
  Stepper,
  Text,
  Toggle,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  accessibilityValue,
  font,
  foregroundStyle,
  labelsHidden,
  lineLimit,
  listStyle,
  monospacedDigit,
} from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";
import type { ReactNode } from "react";

import type { PrivacySetting } from "@/shared/preferences/model";
import { FONT_SIZE } from "@/shared/preferences/store";
import { useColors } from "@/shared/theme/colors";
import { secondary } from "@/shared/ui/ios/modifiers";
import { useLargeText } from "@/shared/ui/large-text";

import type ScreenContract from "./screen";
import type { SettingsProps } from "./screen";
import { machineStatus, text } from "./text";

const tertiary = foregroundStyle({ type: "hierarchical", style: "tertiary" });

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
  const largeText = useLargeText();
  return (
    <>
      <Stack.Screen.Title>{text.title}</Stack.Screen.Title>
      <Host style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
        <List modifiers={[listStyle("insetGrouped")]}>
          <Section title={text.machines}>
            {machines.map((machine) => (
              <NavigationRow key={machine.id} onPress={() => onOpenMachine(machine.id)}>
                <VStack alignment="leading" spacing={2}>
                  <Text modifiers={largeText ? [] : [lineLimit(1)]}>{machine.name}</Text>
                  <Text modifiers={[font({ textStyle: "subheadline" }), secondary]}>
                    {machineStatus(machine.connection)}
                  </Text>
                </VStack>
                <Spacer minLength={8} />
              </NavigationRow>
            ))}
            {/* An action, so it takes the tint and no chevron. */}
            <Button label={text.addMachine} onPress={onAddMachine} />
          </Section>
          <Section>
            <NavigationRow onPress={onOpenThemes}>
              <Text>{text.themes}</Text>
              <Spacer minLength={8} />
              <Text modifiers={[secondary, lineLimit(1)]}>{themeName}</Text>
            </NavigationRow>
            {/* The value sits beside the stepper, which draws no value of its own; the stepper reads it out. */}
            <HStack>
              <Text>{text.fontSize}</Text>
              <Spacer minLength={8} />
              <Text modifiers={[secondary, monospacedDigit(), accessibilityHidden()]}>
                {text.points(fontSize)}
              </Text>
              <Stepper
                label={text.fontSize}
                value={fontSize}
                min={FONT_SIZE.min}
                max={FONT_SIZE.max}
                step={1}
                onValueChange={onFontSize}
                modifiers={[labelsHidden(), accessibilityValue(text.points(fontSize))]}
              />
            </HStack>
          </Section>
          <Section title={text.privacy}>
            {PRIVACY.map(({ setting, label }) => (
              <Toggle
                key={setting}
                label={label}
                isOn={privacy[setting]}
                onIsOnChange={(on) => onPrivacy(setting, on)}
              />
            ))}
          </Section>
        </List>
      </Host>
    </>
  );
}

/** A row that opens a page: its content in the label color, then the chevron. The content spaces itself. */
function NavigationRow({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  const colors = useColors();
  return (
    <Button onPress={onPress}>
      <HStack modifiers={[foregroundStyle({ type: "color", color: colors.text })]}>
        {children}
        <Image
          systemName="chevron.forward"
          modifiers={[
            font({ textStyle: "footnote", weight: "semibold" }),
            tertiary,
            accessibilityHidden(),
          ]}
        />
      </HStack>
    </Button>
  );
}

SettingsScreen satisfies typeof ScreenContract;
