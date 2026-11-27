import addIcon from "@expo/material-symbols/add.xml";
import dropDownIcon from "@expo/material-symbols/keyboard_arrow_down.xml";
import checkIcon from "@expo/material-symbols/check.xml";
import deleteIcon from "@expo/material-symbols/delete.xml";
import branchIcon from "@expo/material-symbols/graph_1.xml";
import {
  DropdownMenu,
  DropdownMenuItem,
  HorizontalDivider,
  Icon,
  Row,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clickable,
  clip,
  defaultMinSize,
  padding,
  Shapes,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";

import { flexible, heading } from "@/modules/compose-modifiers";

import type { WorktreeChoice } from "../../grid";
import { text } from "../../text";

const MENU_CORNER = 16;
const MENU_ELEVATION = 3;
const MENU_WIDTH = 220;
/** The active Worktree's band, inset 4 dp in the menu. */
const BAND_CORNER = 12;
/** The title's touch area reaches past its text, as a button's would. */
const TITLE_CORNER = 20;

/**
 * The top app bar's title. In a repository, the active Worktree, which opens the Worktree menu:
 * New Worktree and Remove Worktree, then the Worktrees with the active one filled. Otherwise, the
 * Workspace's directory, which opens nothing. The bar names the Workspace. No item is red.
 */
export function WorkspaceTitle({
  directory,
  worktrees,
  connected,
  onPickWorktree,
  onNewWorktree,
  onRemoveWorktree,
}: {
  directory: string;
  /** The repository's Worktrees, empty outside one. */
  worktrees: readonly WorktreeChoice[];
  /** A Workspace whose Machine is not connected shows its Worktree without the menu. */
  connected: boolean;
  onPickWorktree: (choice: WorktreeChoice) => void;
  onNewWorktree: (() => void) | undefined;
  /** Absent for the Main Worktree and while a removal is under way. */
  onRemoveWorktree: (() => void) | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const material = useMaterialColors();
  const active = worktrees.find((choice) => choice.active);

  if (active === undefined) {
    return (
      <Text
        maxLines={1}
        overflow="ellipsis"
        style={{ typography: "titleLarge" }}
        modifiers={[heading()]}
      >
        {directory}
      </Text>
    );
  }

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
        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 8 }}
          modifiers={[
            clip(Shapes.RoundedCorner(TITLE_CORNER)),
            ...(connected ? [clickable(() => setExpanded(true))] : []),
            padding(8, 6, 4, 6),
          ]}
        >
          <Icon source={branchIcon} contentDescription={text.worktree} />
          <Text
            maxLines={1}
            overflow="ellipsis"
            style={{ typography: "titleLarge" }}
            modifiers={[flexible(), heading()]}
          >
            {active.worktree.name}
          </Text>
          {/* A chevron, as Material 3 Expressive's menu buttons have, quieter than the name. */}
          {connected && (
            <Icon
              source={dropDownIcon}
              tint={material.onSurfaceVariant}
              contentDescription={undefined}
            />
          )}
        </Row>
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
        {worktrees.map((choice) => (
          <DropdownMenuItem
            key={choice.worktree.path}
            modifiers={[
              defaultMinSize({ minWidth: MENU_WIDTH }),
              padding(4, 0, 4, 0),
              ...(choice.active
                ? [clip(Shapes.RoundedCorner(BAND_CORNER)), background(material.primaryContainer)]
                : []),
            ]}
            onClick={run(() => onPickWorktree(choice))}
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
