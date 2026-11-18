import { Stack } from "expo-router";

import { homeControls, type HomeScreenProps } from "./actions";
import { HomeContent } from "./components/ios/home-content";
import { HomeSearch } from "./components/ios/home-search";
import { homeView } from "./model";
import type ScreenContract from "./screen";
import { text } from "./text";

export default function HomeScreen({ snapshot, ...actions }: HomeScreenProps) {
  const view = homeView(snapshot);
  const controls = homeControls(view, actions);

  return (
    <>
      {controls.searchable ? (
        <HomeSearch snapshot={snapshot} actions={actions} onNewWorkspace={controls.newWorkspace} />
      ) : (
        <HomeContent view={view} actions={actions} />
      )}

      <Stack.Screen.Title large>{text.title}</Stack.Screen.Title>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel={text.more}>
          <Stack.Toolbar.MenuAction
            icon="plus"
            disabled={!controls.addMachine}
            onPress={controls.addMachine}
          >
            {text.addMachine}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="gear"
            disabled={!controls.settings}
            onPress={controls.settings}
          >
            {text.settings}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
    </>
  );
}

HomeScreen satisfies typeof ScreenContract;
