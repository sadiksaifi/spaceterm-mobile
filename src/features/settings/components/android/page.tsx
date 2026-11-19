import backIcon from "@expo/material-symbols/arrow_back.xml";
import { Column, Icon, IconButton, Text, TopAppBar } from "@expo/ui/jetpack-compose";
import { padding } from "@expo/ui/jetpack-compose/modifiers";
import { useRouter } from "expo-router";

import { heading } from "@/modules/compose-modifiers";

import { text } from "../../text";

/** Space between groups, and below the last one above the gesture area. */
export const GROUP_SPACE = 16;

/** The space between two groups that have no header between them. */
export function Gap() {
  return <Column modifiers={[padding(0, GROUP_SPACE / 2, 0, GROUP_SPACE / 2)]}>{null}</Column>;
}

/** The small top app bar of a settings page, with Back. */
export function PageTopBar({ title }: { title: string }) {
  const router = useRouter();
  return (
    <TopAppBar>
      <TopAppBar.NavigationIcon>
        <IconButton onClick={() => router.back()}>
          <Icon source={backIcon} contentDescription={text.back} />
        </IconButton>
      </TopAppBar.NavigationIcon>
      <TopAppBar.Title>
        <Text
          maxLines={1}
          overflow="ellipsis"
          style={{ typography: "titleLarge" }}
          modifiers={[heading()]}
        >
          {title}
        </Text>
      </TopAppBar.Title>
    </TopAppBar>
  );
}
