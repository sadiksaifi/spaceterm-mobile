import { Box, Column, ModalBottomSheet, Text, useMaterialColors } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, padding, verticalScroll } from "@expo/ui/jetpack-compose/modifiers";
import type { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { heading } from "@/modules/compose-modifiers";
import type { Tab } from "@/shared/machines/model";

import { text } from "../../text";
import type { TabCommands } from "../../use-tab-commands";
import { CardGrid } from "./card-grid";

/**
 * The Panes of one Tab, in the grid the Tabs use, with New Pane last. It stays open as Panes
 * come and go, and closes when its Tab does.
 */
export function PanesSheet({
  tab,
  commands,
  snackbar,
}: {
  tab: Tab;
  commands: TabCommands;
  /** The screen's snackbar, which shows here while the sheet covers the screen. */
  snackbar: ReactNode;
}) {
  const material = useMaterialColors();
  const insets = useSafeAreaInsets();
  return (
    <ModalBottomSheet
      onDismissRequest={commands.closePanes}
      containerColor={material.surfaceContainerLow}
    >
      <Box modifiers={[fillMaxWidth()]}>
        <Column
          horizontalAlignment="center"
          verticalArrangement={{ spacedBy: 16 }}
          modifiers={[fillMaxWidth(), verticalScroll(), padding(0, 0, 0, insets.bottom + 16)]}
        >
          <Text style={{ typography: "titleLarge" }} modifiers={[heading()]}>
            {text.panes}
          </Text>
          <CardGrid
            cards={tab.panes.map((pane) => {
              const close = () => commands.closePane(tab, pane);
              return {
                key: pane.id,
                name: pane.name,
                split: { kind: "pane", pane },
                // A Pane fills the screen when picked; that screen is not built yet.
                onPress: () => {},
                closeLabel: text.closePane,
                onClose: close,
                menu: [{ label: text.closePane, control: { onPress: close } }],
              };
            })}
            addLabel={text.newPane}
            onAdd={() => commands.newPane(tab)}
          />
        </Column>
        {snackbar}
      </Box>
    </ModalBottomSheet>
  );
}
