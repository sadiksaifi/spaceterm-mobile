import { Stack } from "expo-router";
import { useState } from "react";

import type { MachinesSnapshot } from "@/shared/machines/model";

import type { Control, HomeActions } from "../../actions";
import { homeView } from "../../model";
import type { RowAlerts } from "../../row-alerts";
import { text } from "../../text";
import { HomeContent } from "./home-content";

/**
 * The Workspaces with the search field and New Workspace in the bottom toolbar. The query lives
 * exactly as long as the field, so a field that goes away takes its filter with it.
 */
export function HomeSearch({
  snapshot,
  actions,
  newWorkspace,
  alerts,
}: {
  snapshot: MachinesSnapshot;
  actions: HomeActions;
  newWorkspace: Control | null;
  alerts: RowAlerts;
}) {
  const [query, setQuery] = useState("");
  // Search hides the navigation bar. When it comes back, a long SwiftUI List keeps the offset it
  // had without the bar and opens a gap under the title, so the list starts again from the top.
  // Remove the key once a long list comes back after Cancel without the gap.
  const [session, setSession] = useState(0);

  return (
    <>
      <HomeContent
        key={session}
        view={homeView(snapshot, query)}
        actions={actions}
        alerts={alerts}
      />
      <Stack.SearchBar
        placeholder={text.search}
        onChangeText={(event) => setQuery(event.nativeEvent.text)}
        onCancelButtonPress={() => {
          setQuery("");
          setSession((count) => count + 1);
        }}
      />
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.SearchBarSlot />
        <Stack.Toolbar.Spacer />
        {/* The label names the button for VoiceOver; a bar button with an icon shows only the icon. */}
        {newWorkspace && (
          <Stack.Toolbar.Button
            icon="plus"
            disabled={!newWorkspace.onPress}
            onPress={newWorkspace.onPress}
            separateBackground
          >
            {text.newWorkspace}
          </Stack.Toolbar.Button>
        )}
      </Stack.Toolbar>
    </>
  );
}
