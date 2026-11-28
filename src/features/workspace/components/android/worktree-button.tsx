import addIcon from "@expo/material-symbols/add.xml";
import checkIcon from "@expo/material-symbols/check.xml";
import deleteIcon from "@expo/material-symbols/delete.xml";
import branchIcon from "@expo/material-symbols/graph_1.xml";
import {
  DropdownMenu,
  DropdownMenuItem,
  FilledIconButton,
  HorizontalDivider,
  Icon,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  alpha,
  background,
  clip,
  defaultMinSize,
  padding,
  Shapes,
  size,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";

import { text } from "../../text";
import type { WorktreeMenu } from "../../worktree-menu";

const MENU_CORNER = 16;
const MENU_ELEVATION = 3;
const MENU_WIDTH = 220;
/** The active Worktree's band, inset 4 dp in the menu. */
const BAND_CORNER = 12;
/** An unavailable button takes Material's disabled opacity. */
const UNAVAILABLE = 0.38;

/**
 * The bar's Worktree button, a circle as wide as the bar is tall, which opens the Worktree menu:
 * New Worktree and Remove Worktree, then the Worktrees with the active one filled. No item is red.
 */
export function WorktreeButton({ menu, diameter }: { menu: WorktreeMenu; diameter: number }) {
  const [expanded, setExpanded] = useState(false);
  const material = useMaterialColors();
  const { connected, choices, onPick, onNewWorktree, onRemoveWorktree } = menu;
  // A Machine that disconnects while the menu is open closes it.
  if (expanded && !connected) setExpanded(false);

  const run = (onPress: (() => void) | undefined) => () => {
    setExpanded(false);
    onPress?.();
  };

  return (
    <DropdownMenu
      expanded={expanded}
      onDismissRequest={() => setExpanded(false)}
      color={material.surfaceContainerHigh}
      cornerRadius={MENU_CORNER}
      shadowElevation={MENU_ELEVATION}
    >
      <DropdownMenu.Trigger>
        <FilledIconButton
          enabled={connected}
          onClick={() => setExpanded(true)}
          colors={{
            containerColor: material.surfaceContainerHigh,
            contentColor: material.onSurface,
            disabledContainerColor: material.surfaceContainerHigh,
            disabledContentColor: material.onSurface,
          }}
          modifiers={[size(diameter, diameter), ...(connected ? [] : [alpha(UNAVAILABLE)])]}
        >
          <Icon source={branchIcon} contentDescription={`${text.worktree}, ${menu.active.name}`} />
        </FilledIconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        <DropdownMenuItem
          enabled={!!onNewWorktree}
          modifiers={[defaultMinSize({ minWidth: MENU_WIDTH })]}
          onClick={run(onNewWorktree)}
        >
          <DropdownMenuItem.LeadingIcon>
            <Icon source={addIcon} contentDescription={undefined} />
          </DropdownMenuItem.LeadingIcon>
          <DropdownMenuItem.Text>
            <Text>{text.newWorktree}</Text>
          </DropdownMenuItem.Text>
        </DropdownMenuItem>
        <DropdownMenuItem
          enabled={!!onRemoveWorktree}
          modifiers={[defaultMinSize({ minWidth: MENU_WIDTH })]}
          onClick={run(onRemoveWorktree)}
        >
          <DropdownMenuItem.LeadingIcon>
            <Icon source={deleteIcon} contentDescription={undefined} />
          </DropdownMenuItem.LeadingIcon>
          <DropdownMenuItem.Text>
            <Text>{text.removeWorktree}</Text>
          </DropdownMenuItem.Text>
        </DropdownMenuItem>
        <HorizontalDivider modifiers={[padding(0, 8, 0, 8)]} />
        {choices.map((choice) => (
          <DropdownMenuItem
            key={choice.worktree.path}
            enabled={connected}
            modifiers={[
              defaultMinSize({ minWidth: MENU_WIDTH }),
              padding(4, 0, 4, 0),
              ...(choice.active
                ? [clip(Shapes.RoundedCorner(BAND_CORNER)), background(material.primaryContainer)]
                : []),
            ]}
            // The popup stays on screen while it closes, so a tap can land after a disconnect.
            onClick={run(connected ? () => onPick(choice) : undefined)}
          >
            {choice.active && (
              <DropdownMenuItem.LeadingIcon>
                <Icon
                  source={checkIcon}
                  tint={material.onPrimaryContainer}
                  contentDescription={text.selected}
                />
              </DropdownMenuItem.LeadingIcon>
            )}
            <DropdownMenuItem.Text>
              <Text color={choice.active ? material.onPrimaryContainer : undefined}>
                {choice.worktree.name}
              </Text>
            </DropdownMenuItem.Text>
          </DropdownMenuItem>
        ))}
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}
