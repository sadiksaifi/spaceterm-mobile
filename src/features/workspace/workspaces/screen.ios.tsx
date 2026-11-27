import { Host } from "@expo/ui";
import { List, Section } from "@expo/ui/swift-ui";
import { listStyle } from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";
import { StyleSheet } from "react-native";

import { rowCommands } from "@/features/home/actions";
import { RowAlertsView } from "@/features/home/components/ios/row-alerts";

import { text } from "../text";
import { WorkspaceRowView } from "./components/ios/workspace-row";
import type ScreenContract from "./screen";
import type { WorkspacesScreenProps } from "./screen";

/** The Workspaces under the system's search field and New Workspace. */
export default function WorkspacesScreen({
  rows,
  selected,
  alerts,
  onSearch,
  onPick,
  onNewWorkspace,
}: WorkspacesScreenProps) {
  return (
    <>
      {/* The header holds only the search and New Workspace; VoiceOver still reads the title. */}
      <Stack.Screen options={{ title: text.workspaces, headerTitle: "" }} />
      <Stack.SearchBar
        placeholder={text.searchWorkspaces}
        placement="integrated"
        // Keeps the field in the header, beside New Workspace, rather than in the bottom bar.
        allowToolbarIntegration={false}
        autoCapitalize="none"
        hideNavigationBar={false}
        obscureBackground={false}
        onChangeText={(event) => onSearch(event.nativeEvent.text)}
        onCancelButtonPress={() => onSearch("")}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="plus"
          accessibilityLabel={text.newWorkspace}
          disabled={!onNewWorkspace}
          onPress={onNewWorkspace}
        />
      </Stack.Toolbar>
      <Host style={styles.fill}>
        <RowAlertsView alerts={alerts}>
          <List modifiers={[listStyle("plain")]}>
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
