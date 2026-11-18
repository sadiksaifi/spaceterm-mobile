import moreIcon from "@expo/material-symbols/more_vert.xml";
import { Host } from "@expo/ui";
import { Box, Column } from "@expo/ui/jetpack-compose";
import { background, fillMaxSize } from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/shared/theme/colors";

import type { HomeScreenProps } from "./actions";
import { HomeContent } from "./components/android/home-content";
import { HomeSearchBar } from "./components/android/home-search-bar";
import { NewWorkspaceButton } from "./components/android/new-workspace-button";
import { homeView, isSearchable } from "./model";
import { text } from "./text";

/** Space below the last row: room for New Workspace when it shows, a margin otherwise. */
const ROOM_FOR_BUTTON = 96;
const LIST_MARGIN = 16;

export default function HomeScreen({ snapshot, ...actions }: HomeScreenProps) {
  const view = homeView(snapshot);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const searchable = isSearchable(view);
  const canCreateWorkspace = searchable && view.canCreateWorkspace;

  return (
    <>
      {/* The search bar takes the header's place where there is something to search. */}
      <Stack.Screen options={{ headerShown: !searchable, headerShadowVisible: false }} />
      <Stack.Screen.Title>{text.title}</Stack.Screen.Title>
      {!searchable && (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon={moreIcon} accessibilityLabel={text.more}>
            <Stack.Toolbar.MenuAction disabled>{text.newWorkspace}</Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              disabled={!actions.onAddMachine}
              onPress={actions.onAddMachine}
            >
              {text.addMachine}
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              disabled={!actions.onOpenSettings}
              onPress={actions.onOpenSettings}
            >
              {text.settings}
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      )}

      <Host style={{ flex: 1 }}>
        <Box modifiers={[fillMaxSize(), background(colors.groupedBackground)]}>
          <Column modifiers={[fillMaxSize()]}>
            {searchable && (
              <HomeSearchBar
                snapshot={snapshot}
                actions={actions}
                canCreateWorkspace={canCreateWorkspace}
              />
            )}
            <HomeContent
              view={view}
              actions={actions}
              bottomPadding={insets.bottom + (canCreateWorkspace ? ROOM_FOR_BUTTON : LIST_MARGIN)}
            />
          </Column>
          {canCreateWorkspace && actions.onNewWorkspace && (
            <NewWorkspaceButton onPress={actions.onNewWorkspace} />
          )}
        </Box>
      </Host>
    </>
  );
}
