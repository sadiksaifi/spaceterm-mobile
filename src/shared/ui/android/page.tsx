import backIcon from "@expo/material-symbols/arrow_back.xml";
import { Column, Icon, IconButton, Text, TopAppBar } from "@expo/ui/jetpack-compose";
import { padding } from "@expo/ui/jetpack-compose/modifiers";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";

import { heading } from "@/modules/compose-modifiers";

/** Space between groups, and below the last one above the gesture area. */
export const GROUP_SPACE = 16;

/** The space between two groups that have no header between them. */
export function Gap() {
  return <Column modifiers={[padding(0, GROUP_SPACE / 2, 0, GROUP_SPACE / 2)]}>{null}</Column>;
}

/** The small top app bar of a pushed page, with Back and the page's actions. */
export function PageTopBar({
  title,
  backLabel,
  actions,
}: {
  title: string;
  backLabel: string;
  actions?: ReactNode;
}) {
  const router = useRouter();
  return (
    <TopAppBar>
      <TopAppBar.NavigationIcon>
        <IconButton onClick={() => router.back()}>
          <Icon source={backIcon} contentDescription={backLabel} />
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
      {actions !== undefined && <TopAppBar.Actions>{actions}</TopAppBar.Actions>}
    </TopAppBar>
  );
}
