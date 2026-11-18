import { Stack } from "expo-router";
import { useState } from "react";

import type { HomeActions } from "../../actions";
import { homeView, type HomeSnapshot } from "../../model";
import { text } from "../../text";
import { HomeContent } from "./home-content";

/**
 * The Workspaces with the search field and New Workspace in the bottom toolbar. The query lives
 * exactly as long as the field, so a field that goes away takes its filter with it.
 */
export function HomeSearch({
  snapshot,
  actions,
  onNewWorkspace,
}: {
  snapshot: HomeSnapshot;
  actions: HomeActions;
  onNewWorkspace: (() => void) | undefined;
}) {
  const [query, setQuery] = useState("");
  // Search hides the navigation bar. When it comes back, a long SwiftUI List keeps the offset it
  // had without the bar and opens a gap under the title, so the list starts again from the top.
  const [session, setSession] = useState(0);

  return (
    <>
      <HomeContent key={session} view={homeView(snapshot, query)} actions={actions} />
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
        <Stack.Toolbar.Button
          icon="plus"
          disabled={!onNewWorkspace}
          onPress={onNewWorkspace}
          separateBackground
        >
          {text.newWorkspace}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}
