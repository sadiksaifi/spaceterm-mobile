import { Box, Text } from "@expo/ui/jetpack-compose";
import { fillMaxSize, fillMaxWidth, imePadding, padding } from "@expo/ui/jetpack-compose/modifiers";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState, type ReactNode } from "react";
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
  useFocusEffect(
    useCallback(
      () => () => {
        void searchBar.current?.collapse();
      },
      [],
    ),
  );

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
            actions={actions}
            alerts={alerts}
            bottomPadding={insets.bottom + 16}
            emptyBottom={EMPTY_BOTTOM_IN_SEARCH}
          />
          {overResults}
        </Box>
      </SearchBar.Results>
    </SearchBar>
  );
}
