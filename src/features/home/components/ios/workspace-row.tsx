import { Button, HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  disabled,
  font,
  foregroundStyle,
  lineLimit,
} from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";

import { useColors } from "@/shared/theme/colors";

import type { HomeActions } from "../../actions";
import { useLargeText } from "../../large-text";
import type { WorkspaceRow } from "../../model";
import { rowStateText } from "../../text";
import { secondary } from "./modifiers";

const detailFont = font({ textStyle: "subheadline" });

export function WorkspaceRowView({
  row,
  onOpen,
}: {
  row: WorkspaceRow;
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
      {connected ? workspace.directory : rowStateText(connection)}
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

  return (
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
