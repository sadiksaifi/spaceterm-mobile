import { Host } from "@expo/ui";
import { Box, Column } from "@expo/ui/jetpack-compose";
import { background, fillMaxSize } from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/shared/theme/colors";

import { homeControls, type HomeScreenProps } from "./actions";
import { HomeContent } from "./components/android/home-content";
import { HomeSearchBar } from "./components/android/home-search-bar";
import { HomeTopBar } from "./components/android/home-top-bar";
import { NewWorkspaceButton } from "./components/android/new-workspace-button";
import { homeView } from "./model";
import type ScreenContract from "./screen";

/** Space below the last row: room for New Workspace where it shows, a margin otherwise. */
const ROOM_FOR_BUTTON = 96;
const LIST_MARGIN = 16;

export default function HomeScreen({ snapshot, ...actions }: HomeScreenProps) {
  const view = homeView(snapshot);
  const controls = homeControls(view, actions);
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <>
      {/* Compose draws the top of the screen: the search bar, or the top app bar. */}
      <Stack.Screen options={{ headerShown: false }} />

      <Host style={{ flex: 1 }}>
        <Box modifiers={[fillMaxSize(), background(colors.groupedBackground)]}>
          <Column modifiers={[fillMaxSize()]}>
            {controls.searchable ? (
              <HomeSearchBar snapshot={snapshot} actions={actions} controls={controls} />
            ) : (
              <HomeTopBar controls={controls} />
            )}
            <HomeContent
              view={view}
              actions={actions}
              bottomPadding={insets.bottom + (controls.searchable ? ROOM_FOR_BUTTON : LIST_MARGIN)}
            />
          </Column>
          {controls.newWorkspace && <NewWorkspaceButton control={controls.newWorkspace} />}
        </Box>
      </Host>
    </>
  );
}

HomeScreen satisfies typeof ScreenContract;
