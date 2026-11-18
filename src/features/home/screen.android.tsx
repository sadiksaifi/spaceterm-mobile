import { Host } from "@expo/ui";
import { Box, Column } from "@expo/ui/jetpack-compose";
import { background, fillMaxSize } from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/shared/theme/colors";
import { SnackbarSlot, useSnackbar } from "@/shared/ui/android/snackbar";

import { homeControls, type HomeScreenProps } from "./actions";
import { HomeContent } from "./components/android/home-content";
import { HomeSearchBar } from "./components/android/home-search-bar";
import { HomeTopBar } from "./components/android/home-top-bar";
import { NewWorkspaceButton } from "./components/android/new-workspace-button";
import { RowAlertsView } from "./components/android/row-alerts";
import { homeView } from "./model";
import { text } from "./text";
import { useRowAlerts } from "./row-alerts";
import type ScreenContract from "./screen";

/** Space below the last row: room for New Workspace where it shows, a margin otherwise. */
const ROOM_FOR_BUTTON = 96;
const LIST_MARGIN = 16;
/** The snackbar sits above New Workspace: the button's margin, its height, and a gap. */
const ABOVE_BUTTON = 16 + 56 + 16;

export default function HomeScreen({ snapshot, ...actions }: HomeScreenProps) {
  const view = homeView(snapshot);
  const controls = homeControls(view, actions);
  const alerts = useRowAlerts(actions);
  // Android reports a refused command in a snackbar, which leaves the list usable.
  const snackbar = useSnackbar(
    alerts.failure,
    (failure) => ({
      message: text.failedTitle(failure.command, failure.row.workspace.name),
      actionLabel: text.tryAgain,
    }),
    alerts.retry,
    alerts.dismissFailure,
  );
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
              <HomeSearchBar
                snapshot={snapshot}
                actions={actions}
                controls={controls}
                alerts={alerts}
              />
            ) : (
              <HomeTopBar controls={controls} />
            )}
            <HomeContent
              view={view}
              actions={actions}
              alerts={alerts}
              bottomPadding={insets.bottom + (controls.searchable ? ROOM_FOR_BUTTON : LIST_MARGIN)}
            />
          </Column>
          {controls.newWorkspace && <NewWorkspaceButton control={controls.newWorkspace} />}
          <RowAlertsView alerts={alerts} />
          <SnackbarSlot
            {...snackbar}
            bottom={insets.bottom + (controls.newWorkspace ? ABOVE_BUTTON : LIST_MARGIN)}
          />
        </Box>
      </Host>
    </>
  );
}

HomeScreen satisfies typeof ScreenContract;
