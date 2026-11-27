import { Host } from "@expo/ui";
import { Button, Divider, HStack, Image, Menu, Text, Toggle, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityElement,
  accessibilityHidden,
  accessibilityLabel,
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  frame,
  layoutPriority,
  lineLimit,
  menuIndicator,
  menuStyle,
} from "@expo/ui/swift-ui/modifiers";

import type { WorktreeChoice } from "../../grid";
import { text } from "../../text";

const secondary = foregroundStyle({ type: "hierarchical", style: "secondary" });

/**
 * The header's names at the top left: a Workspace symbol beside the Workspace's name and its
 * Machine, over the active Worktree in a repository, which opens the Worktree menu.
 */
export function WorkspaceTitle({
  name,
  machine,
  worktrees,
  connected,
  width,
  onPickWorktree,
  onNewWorktree,
}: {
  name: string;
  machine: string;
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
          {/* One header element that says both names; the Machine gives way first. */}
          <HStack
            alignment="firstTextBaseline"
            spacing={6}
            modifiers={[accessibilityElement("combine"), accessibilityAddTraits(["isHeader"])]}
          >
            <Text modifiers={[font({ textStyle: "headline" }), lineLimit(1), layoutPriority(1)]}>
              {name}
            </Text>
            <Text
              modifiers={[
                font({ textStyle: "footnote" }),
                foregroundStyle({ type: "hierarchical", style: "tertiary" }),
                lineLimit(1),
              ]}
            >
              {`· ${machine}`}
            </Text>
          </HStack>
          {active !== undefined && (
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
