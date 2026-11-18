import { Stack } from "expo-router";
import { useState } from "react";

import type { HomeScreenProps } from "./actions";
import { HomeContent } from "./components/ios/home-content";
import { homeView, isSearchable } from "./model";
import { text } from "./text";

export default function HomeScreen({ snapshot, ...actions }: HomeScreenProps) {
  const [query, setQuery] = useState("");
  const view = homeView(snapshot, query);

  return (
    <>
      <HomeContent view={view} actions={actions} />

      <Stack.Screen.Title large>{text.title}</Stack.Screen.Title>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel={text.more}>
          <Stack.Toolbar.MenuAction
            icon="plus"
            disabled={!actions.onAddMachine}
            onPress={actions.onAddMachine}
          >
            {text.addMachine}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="gear"
            disabled={!actions.onOpenSettings}
            onPress={actions.onOpenSettings}
          >
            {text.settings}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      {isSearchable(view) && (
        <>
          <Stack.SearchBar
            placeholder={text.search}
            onChangeText={(event) => setQuery(event.nativeEvent.text)}
            onCancelButtonPress={() => setQuery("")}
          />
          <Stack.Toolbar placement="bottom">
            <Stack.Toolbar.SearchBarSlot />
            <Stack.Toolbar.Spacer />
            <Stack.Toolbar.Button
              icon="plus"
              accessibilityLabel={text.newWorkspace}
              disabled={!view.canCreateWorkspace || !actions.onNewWorkspace}
              onPress={actions.onNewWorkspace}
              separateBackground
            />
          </Stack.Toolbar>
        </>
      )}
    </>
  );
}
