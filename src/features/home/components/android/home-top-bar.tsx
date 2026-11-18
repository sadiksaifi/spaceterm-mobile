import { Text, TopAppBar } from "@expo/ui/jetpack-compose";

import { heading } from "@/modules/compose-modifiers";

import type { HomeControls } from "../../actions";
import { text } from "../../text";
import { MoreMenu } from "./more-menu";

/**
 * The small top app bar where there is nothing to search. Compose draws it, so its title
 * follows the font scale and its menu is the one the search bar shows.
 */
export function HomeTopBar({ controls }: { controls: HomeControls }) {
  return (
    <TopAppBar>
      <TopAppBar.Title>
        <Text
          maxLines={1}
          overflow="ellipsis"
          style={{ typography: "titleLarge" }}
          modifiers={[heading()]}
        >
          {text.title}
        </Text>
      </TopAppBar.Title>
      <TopAppBar.Actions>
        <MoreMenu controls={controls} />
      </TopAppBar.Actions>
    </TopAppBar>
  );
}
