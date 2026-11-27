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
  glassEffect,
  lineLimit,
  menuIndicator,
  menuStyle,
  padding,
  shapes,
  truncationMode,
} from "@expo/ui/swift-ui/modifiers";

import type { WorktreeChoice } from "../../grid";
import { text } from "../../text";

/** The height of the header's glass buttons, which the label fills so all of it opens the menu. */
const HEIGHT = 44;
const label = font({ textStyle: "body", weight: "medium" });
/** The glass sits at the leading edge of its slot and is as wide as its label. */
const leading = frame({ maxWidth: Number.POSITIVE_INFINITY, alignment: "leading" });

/**
 * The header's top left. In a repository, the active Worktree, which opens the Worktree menu.
 * Otherwise, the Workspace's directory, which opens nothing. The bar names the Workspace.
 *
 * It draws its own glass in a slot of fixed size: the header's glass would take the size of the
 * content only once it measured, so it first showed as a circle and then grew.
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
  /** The slot's width, the widest the glass grows; a longer name is cut short. */
  width: number;
  onPickWorktree: (choice: WorktreeChoice) => void;
  onNewWorktree: (() => void) | undefined;
}) {
  const active = worktrees.find((choice) => choice.active);
  const slot = { width, height: HEIGHT };
  const glass = [
    padding({ horizontal: 14 }),
    frame({ height: HEIGHT }),
    glassEffect({
      glass: { variant: "regular", interactive: active !== undefined },
      shape: "capsule",
    }),
    contentShape(shapes.capsule()),
  ];

  if (active === undefined) {
    return (
      <Host style={slot}>
        <Text modifiers={[label, lineLimit(1), truncationMode("middle"), ...glass, leading]}>
          {directory}
        </Text>
      </Host>
    );
  }

  return (
    <Host style={slot}>
      <Menu
        label={
          <HStack spacing={6} modifiers={glass}>
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
          leading,
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
