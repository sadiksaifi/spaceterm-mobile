import { Box, Text } from "@expo/ui/jetpack-compose";
import { fillMaxSize, fillMaxWidth, imePadding, padding } from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SearchBar } from "@/modules/search-bar";
import type { MachinesSnapshot } from "@/shared/machines/model";
import { EMPTY_BOTTOM_IN_SEARCH } from "@/shared/ui/android/state";

import type { HomeActions, HomeControls } from "../../actions";
import { homeView } from "../../model";
import type { RowAlerts } from "../../row-alerts";
import { text } from "../../text";
import { HomeContent } from "./home-content";
import { MoreMenu } from "./more-menu";

/** The search pill in the header's place. It opens a full-screen search of the Workspaces. */
export function HomeSearchBar({
  snapshot,
  actions,
  controls,
  alerts,
}: {
  snapshot: MachinesSnapshot;
  actions: HomeActions;
  controls: HomeControls;
  alerts: RowAlerts;
}) {
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();

  return (
    <SearchBar
      onQueryChange={setQuery}
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
        </Box>
      </SearchBar.Results>
    </SearchBar>
  );
}
