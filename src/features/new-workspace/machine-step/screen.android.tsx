import closeIcon from "@expo/material-symbols/close.xml";
import notConnectedIcon from "@expo/material-symbols/desktop_access_disabled.xml";
import machineIcon from "@expo/material-symbols/desktop_windows.xml";
import {
  Column,
  Icon,
  IconButton,
  Row,
  Shape,
  Surface,
  Text,
  TopAppBar,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  alpha,
  background,
  fillMaxSize,
  fillMaxWidth,
  padding,
} from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";

import { heading } from "@/modules/compose-modifiers";
import type { Machine } from "@/shared/machines/model";
import { connectionStateText } from "@/shared/machines/text";
import { useColors } from "@/shared/theme/colors";
import { GROUPED_GAP, groupedCorners } from "@/shared/ui/android/grouped";
import { ScreenHost } from "@/shared/ui/android/screen-host";

import { text } from "../text";
import type ScreenContract from "./screen";
import type { MachineStepProps } from "./screen";

/** Material gives a Machine that cannot be picked the disabled look. */
const DIMMED = 0.5;

export default function MachineStepScreen({ machines, onPick, onCancel }: MachineStepProps) {
  const colors = useColors();
  const material = useMaterialColors();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHost>
        <Column modifiers={[fillMaxSize(), background(colors.groupedBackground)]}>
          <TopAppBar>
            <TopAppBar.NavigationIcon>
              <IconButton onClick={onCancel}>
                <Icon source={closeIcon} contentDescription={text.close} />
              </IconButton>
            </TopAppBar.NavigationIcon>
            <TopAppBar.Title>
              <Text maxLines={1} overflow="ellipsis" style={{ typography: "titleLarge" }}>
                {text.title}
              </Text>
            </TopAppBar.Title>
          </TopAppBar>
          <Text
            style={{ typography: "titleSmall" }}
            color={material.primary}
            modifiers={[padding(24, 8, 24, 8), heading()]}
          >
            {text.machine}
          </Text>
          <Column
            verticalArrangement={{ spacedBy: GROUPED_GAP }}
            modifiers={[padding(16, 0, 16, 0)]}
          >
            {machines.map((machine, index) => (
              <MachineRow
                key={machine.id}
                machine={machine}
                first={index === 0}
                last={index === machines.length - 1}
                onPick={onPick}
              />
            ))}
          </Column>
        </Column>
      </ScreenHost>
    </>
  );
}

/** A connected Machine opens its directories. Any other is dimmed and says why. */
function MachineRow({
  machine,
  first,
  last,
  onPick,
}: {
  machine: Machine;
  first: boolean;
  last: boolean;
  onPick: (id: string) => void;
}) {
  const colors = useColors();
  const connected = machine.connection === "connected";
  return (
    <Surface
      color={colors.groupedRow}
      contentColor={colors.text}
      shape={Shape.RoundedCorner({ cornerRadii: groupedCorners(first, last) })}
      enabled={connected}
      onClick={() => onPick(machine.id)}
      modifiers={[fillMaxWidth(), ...(connected ? [] : [alpha(DIMMED)])]}
    >
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 16 }}
        modifiers={[fillMaxWidth(), padding(16, connected ? 16 : 10, 16, connected ? 16 : 10)]}
      >
        <Icon source={connected ? machineIcon : notConnectedIcon} tint={colors.secondaryText} />
        <Column>
          <Text maxLines={1} overflow="ellipsis" style={{ typography: "bodyLarge" }}>
            {machine.name}
          </Text>
          {machine.connection !== "connected" && (
            <Text style={{ typography: "bodyMedium" }} color={colors.secondaryText}>
              {connectionStateText(machine.connection)}
            </Text>
          )}
        </Column>
      </Row>
    </Surface>
  );
}

MachineStepScreen satisfies typeof ScreenContract;
