import { Host } from "@expo/ui";
import { Button, HStack, Image, List, Section, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  disabled,
  font,
  foregroundStyle,
  lineLimit,
  listStyle,
  refreshable,
} from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";

import type { Machine } from "@/shared/machines/model";
import { connectionStateText } from "@/shared/machines/text";
import { useColors } from "@/shared/theme/colors";
import { useLargeText } from "@/shared/ui/large-text";

import { SectionHeader } from "@/shared/ui/ios/section-header";
import { text } from "../text";
import type ScreenContract from "./screen";
import type { MachineStepProps } from "./screen";

const tertiary = foregroundStyle({ type: "hierarchical", style: "tertiary" });

export default function MachineStepScreen({
  machines,
  onPick,
  onCancel,
  onRefresh,
}: MachineStepProps) {
  const colors = useColors();
  return (
    <>
      <Stack.Screen.Title>{text.title}</Stack.Screen.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel={text.cancel} onPress={onCancel} />
      </Stack.Toolbar>
      <Host style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
        <List modifiers={[listStyle("insetGrouped"), refreshable(onRefresh)]}>
          <Section header={<SectionHeader>{text.machine}</SectionHeader>}>
            {machines.map((machine) => (
              <MachineRow key={machine.id} machine={machine} onPick={onPick} />
            ))}
          </Section>
        </List>
      </Host>
    </>
  );
}

/** A connected Machine opens its directories. Any other is dimmed and says why. */
function MachineRow({ machine, onPick }: { machine: Machine; onPick: (id: string) => void }) {
  const colors = useColors();
  const connected = machine.connection === "connected";
  // At accessibility text sizes the state goes under the name, so neither is cut short.
  const largeText = useLargeText();
  const name = <Text modifiers={largeText ? [] : [lineLimit(1)]}>{machine.name}</Text>;
  return (
    <Button onPress={() => onPick(machine.id)} modifiers={[disabled(!connected)]}>
      {/* The tertiary style is taken from the text color around it, so it comes first. */}
      <HStack
        modifiers={[
          ...(connected ? [] : [tertiary]),
          foregroundStyle({ type: "color", color: colors.text }),
        ]}
      >
        {largeText && !connected ? (
          <VStack alignment="leading" spacing={2}>
            {name}
            <Text>{connectionStateText(machine.connection)}</Text>
          </VStack>
        ) : (
          name
        )}
        <Spacer minLength={8} />
        {connected ? (
          <Image
            systemName="chevron.forward"
            modifiers={[
              font({ textStyle: "footnote", weight: "semibold" }),
              tertiary,
              accessibilityHidden(),
            ]}
          />
        ) : (
          !largeText && <Text>{connectionStateText(machine.connection)}</Text>
        )}
      </HStack>
    </Button>
  );
}

MachineStepScreen satisfies typeof ScreenContract;
