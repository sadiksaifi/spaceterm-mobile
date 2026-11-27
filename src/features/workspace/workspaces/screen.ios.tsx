import { Host } from "@expo/ui";
import { List, Section } from "@expo/ui/swift-ui";
import { listStyle, scrollEdgeEffectStyle } from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";
import { StyleSheet } from "react-native";

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
  return (
    <>
      {/* As New Workspace's sheet: Close at the left of the title. */}
      <Stack.Screen options={{ title: text.workspaces }} />
      <Stack.Toolbar placement="left">
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

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

WorkspacesScreen satisfies typeof ScreenContract;
