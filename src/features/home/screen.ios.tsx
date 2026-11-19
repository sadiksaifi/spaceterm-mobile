import { Stack } from "expo-router";

import { homeControls, type HomeScreenProps } from "./actions";
import { HomeContent } from "./components/ios/home-content";
import { HomeSearch } from "./components/ios/home-search";
import { homeView } from "./model";
import { useRowAlerts } from "./row-alerts";
import type ScreenContract from "./screen";
import { text } from "./text";

export default function HomeScreen({ snapshot, ...actions }: HomeScreenProps) {
  const view = homeView(snapshot);
  const controls = homeControls(view, actions);
  const alerts = useRowAlerts(actions, snapshot);

  return (
    <>
      {controls.searchable ? (
        <HomeSearch
          snapshot={snapshot}
          actions={actions}
          newWorkspace={controls.newWorkspace}
          alerts={alerts}
        />
      ) : (
        <HomeContent view={view} actions={actions} alerts={alerts} />
      )}

      <Stack.Screen.Title large>{text.title}</Stack.Screen.Title>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel={text.more}>
          <Stack.Toolbar.MenuAction
            icon="plus"
            disabled={!controls.addMachine.onPress}
            onPress={controls.addMachine.onPress}
          >
            {text.addMachine}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="gear"
            disabled={!controls.settings.onPress}
            onPress={controls.settings.onPress}
          >
            {text.settings}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
    </>
  );
}

HomeScreen satisfies typeof ScreenContract;
