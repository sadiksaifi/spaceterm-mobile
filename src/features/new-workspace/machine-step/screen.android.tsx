import closeIcon from "@expo/material-symbols/close.xml";
import notConnectedIcon from "@expo/material-symbols/desktop_access_disabled.xml";
import machineIcon from "@expo/material-symbols/desktop_windows.xml";
import refreshIcon from "@expo/material-symbols/refresh.xml";
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
  defaultMinSize,
  fillMaxSize,
  fillMaxWidth,
  padding,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { heading } from "@/modules/compose-modifiers";
import type { Machine } from "@/shared/machines/model";
import { connectionStateText } from "@/shared/machines/text";
import { useColors } from "@/shared/theme/colors";
import { GROUPED_GAP, groupedCorners } from "@/shared/ui/android/grouped";
import { Refreshable } from "@/shared/ui/android/refreshable";
import { ScreenHost } from "@/shared/ui/android/screen-host";

import { text } from "../text";
import type ScreenContract from "./screen";
import type { MachineStepProps } from "./screen";

/** Material gives a Machine that cannot be picked the disabled look. */
const DIMMED = 0.5;
/** Space below the last Machine, above the gesture area. */
const LIST_MARGIN = 16;
/** A Machine that says why it cannot be picked takes two lines, at Material's two-line height. */
const TWO_LINE_HEIGHT = 72;

export default function MachineStepScreen({
  machines,
  onPick,
  onCancel,
  onRefresh,
}: MachineStepProps) {
  const colors = useColors();
  const material = useMaterialColors();
  const insets = useSafeAreaInsets();
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
            <TopAppBar.Actions>
              <IconButton onClick={() => void onRefresh()}>
                <Icon source={refreshIcon} contentDescription={text.refresh} />
              </IconButton>
            </TopAppBar.Actions>
          </TopAppBar>
          <Text
            style={{ typography: "titleSmall" }}
            color={material.primary}
            modifiers={[padding(24, 8, 24, 8), heading()]}
          >
            {text.machine}
          </Text>
          {/* The heading stays; the Machines scroll when they outgrow the window, and the last ends
              clear of the gesture area. */}
          <Refreshable onRefresh={onRefresh} modifiers={[fillMaxWidth(), weight(1)]}>
            <Column
              verticalArrangement={{ spacedBy: GROUPED_GAP }}
              modifiers={[
                fillMaxSize(),
                verticalScroll(),
                padding(16, 0, 16, insets.bottom + LIST_MARGIN),
              ]}
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
          </Refreshable>
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
        modifiers={[
          fillMaxWidth(),
          ...(connected ? [] : [defaultMinSize({ minHeight: TWO_LINE_HEIGHT })]),
          padding(16, connected ? 16 : 10, 16, connected ? 16 : 10),
        ]}
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
