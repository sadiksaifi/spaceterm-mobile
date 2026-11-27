import { Host } from "@expo/ui";
import { Button, Divider, HStack, Image, Menu, Text, Toggle, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityHidden,
  accessibilityLabel,
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  menuIndicator,
  menuStyle,
  truncationMode,
} from "@expo/ui/swift-ui/modifiers";

import type { WorktreeChoice } from "../../grid";
import { text } from "../../text";

const secondary = foregroundStyle({ type: "hierarchical", style: "secondary" });

/**
 * The header's names at the top left: a Workspace symbol beside the Workspace's name, over its
 * active Worktree in a repository, which opens the Worktree menu, or over its directory.
 */
export function WorkspaceTitle({
  name,
  directory,
  worktrees,
  connected,
  width,
  onPickWorktree,
  onNewWorktree,
}: {
  name: string;
  directory: string;
  /** The repository's Worktrees, empty outside one. */
  worktrees: readonly WorktreeChoice[];
  /** A Workspace whose Machine is not connected shows its Worktree without the menu. */
  connected: boolean;
  /** The widest the names grow, beside the header's buttons. */
  width: number;
  onPickWorktree: (choice: WorktreeChoice) => void;
  onNewWorktree: (() => void) | undefined;
}) {
  const active = worktrees.find((choice) => choice.active);

  return (
    <Host matchContents>
      <HStack spacing={10} modifiers={[frame({ maxWidth: width, alignment: "leading" })]}>
        <Image
          systemName="rectangle.stack"
          modifiers={[font({ textStyle: "title2" }), secondary, accessibilityHidden()]}
        />
        <VStack alignment="leading" spacing={1}>
          <Text
            modifiers={[
              font({ textStyle: "headline" }),
              lineLimit(1),
              accessibilityAddTraits(["isHeader"]),
            ]}
          >
            {name}
          </Text>
          {active === undefined ? (
            <Text
              modifiers={[
                font({ textStyle: "subheadline" }),
                secondary,
                lineLimit(1),
                truncationMode("middle"),
              ]}
            >
              {directory}
            </Text>
          ) : (
            <Menu
              label={
                <HStack spacing={3} modifiers={[secondary]}>
                  <Image
                    systemName="arrow.triangle.branch"
                    modifiers={[font({ textStyle: "caption" })]}
                  />
                  <Text modifiers={[font({ textStyle: "subheadline" }), lineLimit(1)]}>
                    {active.worktree.name}
                  </Text>
                  <Image
                    systemName="chevron.down"
                    modifiers={[font({ textStyle: "caption2", weight: "semibold" })]}
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
          )}
        </VStack>
      </HStack>
    </Host>
  );
}
