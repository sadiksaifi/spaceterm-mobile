import { Host } from "@expo/ui";
import { List, Section, Text } from "@expo/ui/swift-ui";
import { font, frame, listStyle, scrollEdgeEffectStyle } from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";
import { StyleSheet, useWindowDimensions } from "react-native";

import { rowCommands } from "@/features/home/actions";
import { RowAlertsView } from "@/features/home/components/ios/row-alerts";

import { text } from "../text";
import { WorkspaceRowView } from "./components/ios/workspace-row";
import type ScreenContract from "./screen";
import type { WorkspacesScreenProps } from "./screen";

/** The Workspaces, with the system's search field and New Workspace in the bottom bar. */
export default function WorkspacesScreen({
  rows,
  selected,
  alerts,
  onSearch,
  onPick,
  onNewWorkspace,
  onClose,
}: WorkspacesScreenProps) {
  const window = useWindowDimensions();
  return (
    <>
      {/* As the system's own half sheets draw it: a bold title at the left, Close at the right. */}
      <Stack.Screen options={{ title: text.workspaces, headerTitle: "" }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.View hidesSharedBackground>
          <Host style={{ width: window.width * TITLE_SHARE, height: TITLE_HEIGHT }}>
            <Text
              modifiers={[
                font({ textStyle: "title2", weight: "bold" }),
                frame({ maxWidth: FILL, maxHeight: FILL, alignment: "leading" }),
              ]}
            >
              {text.workspaces}
            </Text>
          </Host>
        </Stack.Toolbar.View>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel={text.close} onPress={onClose} />
      </Stack.Toolbar>
      <Stack.SearchBar
        placeholder={text.searchWorkspaces}
        placement="integrated"
        autoCapitalize="none"
        hideNavigationBar={false}
        obscureBackground={false}
        onChangeText={(event) => onSearch(event.nativeEvent.text)}
        onCancelButtonPress={() => onSearch("")}
      />
      {/* New Workspace sits beside the search, both within reach of the thumb. */}
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.SearchBarSlot />
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button
          icon="plus"
          accessibilityLabel={text.newWorkspace}
          disabled={!onNewWorkspace}
          onPress={onNewWorkspace}
          separateBackground
        />
      </Stack.Toolbar>
      <Host style={styles.fill}>
        <RowAlertsView alerts={alerts}>
          {/* A hard edge gives the header its band: the soft one barely shows over a SwiftUI list. */}
          <List modifiers={[listStyle("plain"), scrollEdgeEffectStyle("hard", "top")]}>
            <Section>
              {rows.map((row) => (
                <WorkspaceRowView
                  key={row.key}
                  row={row}
                  checked={row.key === selected}
                  commands={rowCommands(row, alerts.handlers, alerts.underway.get(row.key) ?? null)}
                  onPick={() => onPick(row)}
                />
              ))}
            </Section>
          </List>
        </RowAlertsView>
      </Host>
    </>
  );
}

/** The most of the sheet's width the title takes, leaving the rest to Close. */
const TITLE_SHARE = 0.6;
const TITLE_HEIGHT = 44;
/** Lets a frame take all the space its container offers, like SwiftUI's `.infinity`. */
const FILL = Number.POSITIVE_INFINITY;

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

WorkspacesScreen satisfies typeof ScreenContract;
