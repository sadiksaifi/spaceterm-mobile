import { Host } from "@expo/ui";
import { List, Section } from "@expo/ui/swift-ui";
import { ignoreSafeArea, listStyle, padding } from "@expo/ui/swift-ui/modifiers";
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
}: WorkspacesScreenProps) {
  return (
    <>
      {/* No title shows: the rows make plain what the sheet holds. VoiceOver still reads it. */}
      <Stack.Screen
        options={{ title: text.workspaces, headerTitle: "", headerTransparent: true }}
      />
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
          {/* The header shows no title, so the list rises into it, stopping short of the grabber. */}
          <List
            modifiers={[
              listStyle("plain"),
              padding({ top: GRABBER_CLEARANCE }),
              ignoreSafeArea({ edges: "top" }),
            ]}
          >
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

/** The space between the grabber and the first row. */
const GRABBER_CLEARANCE = 16;

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

WorkspacesScreen satisfies typeof ScreenContract;
