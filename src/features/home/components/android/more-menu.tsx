import moreIcon from "@expo/material-symbols/more_vert.xml";
import {
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  IconButton,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import { useState } from "react";

import type { HomeActions } from "../../actions";
import { text } from "../../text";

/** The More options button at the end of the search bar, and its menu. */
export function MoreMenu({
  actions,
  canCreateWorkspace,
}: {
  actions: HomeActions;
  canCreateWorkspace: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const colors = useMaterialColors();
  const item = (label: string, onPress: (() => void) | undefined) => (
    <DropdownMenuItem
      enabled={!!onPress}
      onClick={() => {
        setExpanded(false);
        onPress?.();
      }}
    >
      <DropdownMenuItem.Text>
        <Text>{label}</Text>
      </DropdownMenuItem.Text>
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu
      expanded={expanded}
      onDismissRequest={() => setExpanded(false)}
      color={colors.surfaceContainerHigh}
      cornerRadius={16}
    >
      <DropdownMenu.Trigger>
        <IconButton onClick={() => setExpanded(true)}>
          <Icon source={moreIcon} contentDescription={text.more} />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        {item(text.newWorkspace, canCreateWorkspace ? actions.onNewWorkspace : undefined)}
        {item(text.addMachine, actions.onAddMachine)}
        {item(text.settings, actions.onOpenSettings)}
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}
