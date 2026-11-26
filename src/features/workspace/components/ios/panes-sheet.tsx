import { BottomSheet, Group, ScrollView, Text, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  font,
  padding,
  presentationDetents,
  presentationDragIndicator,
} from "@expo/ui/swift-ui/modifiers";
import { useState, type ReactNode } from "react";
import { useWindowDimensions } from "react-native";

import type { Tab } from "@/shared/machines/model";

import { text } from "../../text";
import type { TabCommands } from "../../use-tab-commands";
import { CardGrid, cardGridHeight } from "./card-grid";
import { menuItem } from "./workspace-bar";

const PADDING_TOP = 28;
const PADDING_BOTTOM = 24;
const SPACING = 24;
/** The headline's line height. */
const HEADER = 22;
/** A sheet short of the full height floats this far inside the screen's edges. */
const SHEET_INSET = 8;

/**
 * The Panes of one Tab, in the grid the Tabs use, with New Pane last. It stays open as Panes
 * come and go, and closes when its Tab does.
 */
export function PanesSheet({
  tab,
  commands,
  alertsView,
}: {
  tab: Tab | null;
  commands: TabCommands;
  /** Wraps the sheet's content in the alerts, which show over the topmost view. */
  alertsView: (children: ReactNode) => ReactNode;
}) {
  const width = useWindowDimensions().width - 2 * SHEET_INSET;
  // As tall as its Panes, up to the full height.
  // The Tab whose sheet the person pulled to the full height; it stays there for that Tab.
  const [fullFor, setFullFor] = useState<string | null>(null);
  const full = tab !== null && fullFor === tab.id;
  const fit =
    tab &&
    PADDING_TOP + HEADER + SPACING + cardGridHeight(tab.panes.length, width) + PADDING_BOTTOM;
  return (
    <BottomSheet
      isPresented={tab !== null}
      onIsPresentedChange={(presented) => {
        if (presented) return;
        setFullFor(null);
        commands.closePanes();
      }}
    >
      <Group
        modifiers={[
          presentationDetents(fit ? [{ height: fit }, "large"] : ["large"], {
            // Selected explicitly, so a grid that grows a row takes the new height.
            selection: full || !fit ? "large" : { height: fit },
            onSelectionChange: (detent) =>
              setFullFor(detent === "large" ? (tab?.id ?? null) : null),
          }),
          presentationDragIndicator("visible"),
        ]}
      >
        {tab &&
          alertsView(
            <ScrollView>
              <VStack
                spacing={SPACING}
                modifiers={[padding({ top: PADDING_TOP, bottom: PADDING_BOTTOM })]}
              >
                <Text
                  modifiers={[
                    font({ textStyle: "headline" }),
                    accessibilityAddTraits(["isHeader"]),
                  ]}
                >
                  {text.panes}
                </Text>
                <CardGrid
                  width={width}
                  cards={tab.panes.map((pane) => {
                    const close = { onPress: () => commands.closePane(tab, pane) };
                    return {
                      key: pane.id,
                      name: pane.name,
                      split: { kind: "pane", pane },
                      // A Pane fills the screen when picked; that screen is not built yet.
                      onPress: () => {},
                      closeLabel: text.closePane,
                      onClose: close.onPress,
                      menu: menuItem(text.closePane, "xmark", close, true),
                    };
                  })}
                  addLabel={text.newPane}
                  onAdd={() => commands.newPane(tab)}
                />
              </VStack>
            </ScrollView>,
          )}
      </Group>
    </BottomSheet>
  );
}
