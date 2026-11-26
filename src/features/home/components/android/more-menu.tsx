import moreIcon from "@expo/material-symbols/more_vert.xml";
import {
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  IconButton,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import { defaultMinSize } from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";

import type { Control, HomeControls } from "../../actions";
import { text } from "../../text";

/** Material 3 menus: the high surface container, 16 dp corners and level 2 elevation. */
const MENU_CORNER = 16;
const MENU_ELEVATION = 3;
/** The design's menu width, wider than Material's 112 dp minimum. */
const MENU_WIDTH = 196;

/**
 * The More options button and its menu, at the end of the search bar or the top app bar. New
 * Workspace and Refresh are listed only where Workspaces can be listed.
 */
export function MoreMenu({ controls }: { controls: HomeControls }) {
  const [expanded, setExpanded] = useState(false);
  const colors = useMaterialColors();
  const item = (label: string, { onPress }: Control) => (
    <DropdownMenuItem
      enabled={!!onPress}
      modifiers={[defaultMinSize({ minWidth: MENU_WIDTH })]}
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
      cornerRadius={MENU_CORNER}
      shadowElevation={MENU_ELEVATION}
    >
      <DropdownMenu.Trigger>
        <IconButton onClick={() => setExpanded(true)}>
          <Icon source={moreIcon} contentDescription={text.more} />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        {controls.newWorkspace && item(text.newWorkspace, controls.newWorkspace)}
        {controls.refresh && item(text.refresh, controls.refresh)}
        {item(text.addMachine, controls.addMachine)}
        {item(text.settings, controls.settings)}
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}
