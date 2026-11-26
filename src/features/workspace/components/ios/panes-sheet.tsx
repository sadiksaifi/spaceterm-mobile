import { BottomSheet, Group, ScrollView, Text, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  font,
  padding,
  presentationDetents,
  presentationDragIndicator,
} from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";

import type { Tab } from "@/shared/machines/model";

import { text } from "../../text";
import type { TabCommands } from "../../use-tab-commands";
import { CardGrid } from "./card-grid";
import { menuItem } from "./workspace-bar";

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
  return (
    <BottomSheet
      isPresented={tab !== null}
      onIsPresentedChange={(presented) => !presented && commands.closePanes()}
    >
      <Group
        modifiers={[presentationDetents(["medium", "large"]), presentationDragIndicator("visible")]}
      >
        {tab &&
          alertsView(
            <ScrollView>
              <VStack spacing={24} modifiers={[padding({ top: 28, bottom: 24 })]}>
                <Text
                  modifiers={[
                    font({ textStyle: "headline" }),
                    accessibilityAddTraits(["isHeader"]),
                  ]}
                >
                  {text.panes}
                </Text>
                <CardGrid
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
