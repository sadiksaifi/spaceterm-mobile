import { Host } from "@expo/ui";
import { Button, Divider, HStack, Image, Menu, Text, Toggle } from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  accessibilityLabel,
  buttonStyle,
  contentShape,
  disabled,
  font,
  frame,
  lineLimit,
  menuIndicator,
  menuStyle,
  padding,
  shapes,
  truncationMode,
} from "@expo/ui/swift-ui/modifiers";

import type { WorktreeChoice } from "../../grid";
import { text } from "../../text";

/** The header's height, which the label fills so all of the glass opens the menu. */
const HEIGHT = 44;
const label = font({ textStyle: "body", weight: "medium" });

/**
 * The header's top left, on the header's glass. In a repository, the active Worktree, which opens
 * the Worktree menu. Otherwise, the Workspace's directory, which opens nothing. The bar names the
 * Workspace.
 */
export function WorkspaceTitle({
  directory,
  worktrees,
  connected,
  width,
  onPickWorktree,
  onNewWorktree,
}: {
  directory: string;
  /** The repository's Worktrees, empty outside one. */
  worktrees: readonly WorktreeChoice[];
  /** A Workspace whose Machine is not connected shows its Worktree without the menu. */
  connected: boolean;
  /** The widest it grows; a longer name is cut short. */
  width: number;
  onPickWorktree: (choice: WorktreeChoice) => void;
  onNewWorktree: (() => void) | undefined;
}) {
  const active = worktrees.find((choice) => choice.active);
  const fill = [
    padding({ horizontal: 14 }),
    frame({ maxWidth: width }),
    frame({ height: HEIGHT }),
    contentShape(shapes.capsule()),
  ];

  if (active === undefined) {
    return (
      <Host matchContents>
        <Text modifiers={[label, lineLimit(1), truncationMode("middle"), ...fill]}>
          {directory}
        </Text>
      </Host>
    );
  }

  return (
    <Host matchContents>
      <Menu
        label={
          <HStack spacing={6} modifiers={fill}>
            <Image systemName="arrow.triangle.branch" modifiers={[label, accessibilityHidden()]} />
            <Text modifiers={[label, lineLimit(1)]}>{active.worktree.name}</Text>
            <Image
              systemName="chevron.down"
              modifiers={[
                font({ textStyle: "caption", weight: "semibold" }),
                accessibilityHidden(),
              ]}
            />
          </HStack>
        }
        modifiers={[
          menuStyle("button"),
          buttonStyle("plain"),
          menuIndicator("hidden"),
          disabled(!connected),
          accessibilityLabel(`${text.worktree}, ${active.worktree.name}`),
        ]}
      >
        {worktrees.map((choice) => (
          <Toggle
            key={choice.worktree.path}
            label={choice.worktree.name}
            isOn={choice.active}
            onIsOnChange={() => onPickWorktree(choice)}
          />
        ))}
        <Divider />
        <Button
          label={text.newWorktree}
          systemImage="plus"
          onPress={onNewWorktree}
          modifiers={[disabled(!onNewWorktree)]}
        />
      </Menu>
    </Host>
  );
}
