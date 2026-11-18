import { Button, HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { disabled, fixedSize, font, foregroundStyle, lineLimit } from "@expo/ui/swift-ui/modifiers";

import { useColors } from "@/shared/theme/colors";

import type { HomeActions } from "../../actions";
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
  const { workspace, connection } = row;
  const connected = connection === "connected";

  return (
    <Button onPress={() => onOpen?.(row)} modifiers={[disabled(!onOpen)]}>
      {/* A Button in a List tints its label. The row reads as text, so it starts from the text color. */}
      <HStack spacing={10} modifiers={[foregroundStyle({ type: "color", color: colors.text })]}>
        <VStack alignment="leading" spacing={2}>
          <HStack spacing={0} alignment="firstTextBaseline">
            <Text
              modifiers={[
                font({ textStyle: "headline" }),
                foregroundStyle({
                  type: "hierarchical",
                  style: connected ? "primary" : "secondary",
                }),
                lineLimit(1),
              ]}
            >
              {workspace.name}
            </Text>
            <Spacer minLength={8} />
            <Text modifiers={[detailFont, secondary, lineLimit(1), fixedSize()]}>
              {row.machineName}
            </Text>
          </HStack>
          <HStack spacing={0}>
            <Text modifiers={[detailFont, secondary, lineLimit(1)]}>
              {connected ? workspace.directory : rowStateText(connection)}
            </Text>
            <Spacer minLength={8} />
            {connected && workspace.branch !== undefined && (
              <HStack spacing={3} modifiers={[fixedSize()]}>
                <Image
                  systemName="arrow.triangle.branch"
                  modifiers={[font({ textStyle: "caption" }), secondary]}
                />
                <Text modifiers={[detailFont, secondary, lineLimit(1)]}>{workspace.branch}</Text>
              </HStack>
            )}
          </HStack>
        </VStack>
        <Image
          systemName="chevron.forward"
          modifiers={[
            font({ textStyle: "footnote", weight: "semibold" }),
            foregroundStyle({ type: "hierarchical", style: "tertiary" }),
          ]}
        />
      </HStack>
    </Button>
  );
}
