import { Box, Text } from "@expo/ui/jetpack-compose";
import { fillMaxSize, fillMaxWidth, imePadding, padding } from "@expo/ui/jetpack-compose/modifiers";
import { useNavigation, type NativeStackNavigationProp } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SearchBar, type SearchBarRef } from "@/modules/search-bar";
import type { MachinesSnapshot } from "@/shared/machines/model";

import type { HomeActions, HomeControls } from "../../actions";
import { homeView } from "../../model";
import type { RowAlerts } from "../../row-alerts";
import { text } from "../../text";
import { HomeContent } from "./home-content";
import { EMPTY_BOTTOM_IN_SEARCH } from "./states/empty-state";
import { MoreMenu } from "./more-menu";
import { createSearchExit, type SearchExit } from "./search-exit";

/** Settles a call to the search bar. A search bar Home has already removed took its search along. */
function settle(call: Promise<void> | undefined) {
  call?.catch((error: unknown) => {
    if ((error as { code?: unknown } | null)?.code !== "ERR_VIEW_NOT_FOUND") console.error(error);
  });
}

/**
 * The search pill in the header's place. It opens a full-screen search of the Workspaces.
 * Leaving Home ends the search, as a Material search view closes when a result opens: the
 * full-screen search is a window above every screen, so it would cover the one that opens.
 */
export function HomeSearchBar({
  snapshot,
  actions,
  controls,
  alerts,
  onSearchingChange,
  overResults,
}: {
  snapshot: MachinesSnapshot;
  actions: HomeActions;
  controls: HomeControls;
  alerts: RowAlerts;
  onSearchingChange: (searching: boolean) => void;
  /** What shows over the results while search is open, such as the snackbar. */
  overResults: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();
  const searchBar = useRef<SearchBarRef>(null);
  const exit = useRef<SearchExit>(null);
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, undefined>>>();
  // A selection closes search at once behind a picture of it, and the next screen opens over the
  // picture. Home loses focus as the navigation starts, while the next screen still has to mount.
  useEffect(() => {
    const current = createSearchExit({
      cover: () => settle(searchBar.current?.cover()),
      uncover: () => settle(searchBar.current?.uncover()),
    });
    exit.current = current;
    const unsubscribe = [
      navigation.addListener("blur", current.blur),
      navigation.addListener("focus", current.focus),
      navigation.addListener("transitionEnd", ({ data }) => {
        if (data.closing) current.hidden();
      }),
    ];
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") current.resume();
    });
    return () => {
      for (const remove of unsubscribe) remove();
      appState.remove();
      current.dispose();
      exit.current = null;
    };
  }, [navigation]);
  // Only the first result selected leads away.
  const once =
    <A extends unknown[]>(handler: ((...args: A) => void) | undefined) =>
    (...args: A) => {
      if (handler && exit.current?.select()) handler(...args);
    };
  const { onOpenWorkspace } = actions;
  const resultActions: HomeActions = {
    ...actions,
    onOpenWorkspace: onOpenWorkspace && once(onOpenWorkspace),
  };
  const { onNewTab } = alerts.handlers;
  const resultAlerts: RowAlerts = {
    ...alerts,
    handlers: { ...alerts.handlers, onNewTab: onNewTab && once(onNewTab) },
  };

  return (
    <SearchBar
      ref={searchBar}
      onQueryChange={setQuery}
      onExpandedChange={onSearchingChange}
      backLabel={text.back}
      clearLabel={text.clearText}
      modifiers={[fillMaxWidth(), padding(16, insets.top + 4, 16, 0)]}
    >
      <SearchBar.Placeholder>
        <Text>{text.searchWorkspaces}</Text>
      </SearchBar.Placeholder>
      <SearchBar.TrailingIcon>
        <MoreMenu controls={controls} />
      </SearchBar.TrailingIcon>
      <SearchBar.Results>
        {/* Results sit above the keyboard. */}
        <Box modifiers={[fillMaxSize(), imePadding()]}>
          <HomeContent
            view={homeView(snapshot, query)}
            actions={resultActions}
            alerts={resultAlerts}
            bottomPadding={insets.bottom + 16}
            emptyBottom={EMPTY_BOTTOM_IN_SEARCH}
          />
          {overResults}
        </Box>
      </SearchBar.Results>
    </SearchBar>
  );
}
