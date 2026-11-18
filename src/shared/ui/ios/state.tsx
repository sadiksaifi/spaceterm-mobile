import { Button, Image, ScrollView, Text, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityHidden,
  buttonBorderShape,
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import type { ComponentProps, ReactNode } from "react";
import { useWindowDimensions, type ColorValue } from "react-native";

import { useLargeText } from "../large-text";
import { secondary } from "./modifiers";

/** Empty-state metrics from the mockups. */
const ICON_SIZE = 48;
const ACTION_WIDTH = 230;
export const ACTION_HEIGHT = 34;
/** Empty states sit above center, clear of the bottom toolbar. */
const BOTTOM_INSET = 96;
/** How much the Large Title style grows at the largest Dynamic Type size; the icon grows as much. */
const MAX_ICON_SCALE = 1.76;
/** Space above a state that scrolls, below the large title. */
const LARGE_TEXT_TOP = 24;
/** Lets a frame take all the space its container offers, like SwiftUI's `.infinity`. */
const FILL = Number.POSITIVE_INFINITY;

/**
 * Fills the screen and centers its content above the bottom toolbar. At accessibility text sizes
 * the content can be taller than the screen, so it scrolls from the top instead.
 */
export function Centered({
  children,
  extraBottom = 0,
}: {
  children: ReactNode;
  extraBottom?: number;
}) {
  const largeText = useLargeText();
  const bottom = BOTTOM_INSET + extraBottom;

  if (largeText) {
    return (
      <ScrollView>
        <VStack
          spacing={0}
          modifiers={[
            padding({ top: LARGE_TEXT_TOP, leading: 40, trailing: 40, bottom }),
            frame({ maxWidth: FILL }),
          ]}
        >
          {children}
        </VStack>
      </ScrollView>
    );
  }
  return (
    <VStack
      spacing={0}
      modifiers={[
        padding({ leading: 40, trailing: 40, bottom }),
        frame({ maxWidth: FILL, maxHeight: FILL }),
      ]}
    >
      {children}
    </VStack>
  );
}

export function StateIcon({
  systemName,
}: {
  systemName: ComponentProps<typeof Image>["systemName"];
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <Image
      systemName={systemName}
      modifiers={[
        font({ size: ICON_SIZE * Math.min(fontScale, MAX_ICON_SCALE) }),
        secondary,
        padding({ bottom: 14 }),
        accessibilityHidden(),
      ]}
    />
  );
}

export function StateTitle({ children }: { children: string }) {
  return (
    <Text
      modifiers={[
        font({ textStyle: "title2", weight: "bold" }),
        multilineTextAlignment("center"),
        accessibilityAddTraits(["isHeader"]),
      ]}
    >
      {children}
    </Text>
  );
}

export function StateBody({ children }: { children: ReactNode }) {
  return (
    <Text
      modifiers={[
        font({ textStyle: "callout" }),
        secondary,
        multilineTextAlignment("center"),
        padding({ top: 6 }),
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * A command inside a sentence, in the monospaced system font and the text color. A plain function,
 * not a component: a nested Text renders only when the element passed in is a Text itself.
 */
export function commandText(command: string, color: ColorValue) {
  return (
    <Text
      modifiers={[
        font({ textStyle: "subheadline", design: "monospaced" }),
        foregroundStyle({ type: "color", color }),
      ]}
    >
      {command}
    </Text>
  );
}

/**
 * A capsule button of an empty state: filled blue when prominent, gray otherwise. It has the
 * mockup's width, and at accessibility text sizes it grows with its label instead of truncating it.
 */
export function ActionButton({
  label,
  onPress,
  prominent = false,
}: {
  label: string;
  onPress: (() => void) | undefined;
  prominent?: boolean;
}) {
  const largeText = useLargeText();
  return (
    <Button
      onPress={onPress}
      modifiers={[
        buttonStyle(prominent ? "borderedProminent" : "bordered"),
        buttonBorderShape("capsule"),
        largeText ? frame({ minWidth: ACTION_WIDTH }) : frame({ width: ACTION_WIDTH }),
        disabled(!onPress),
      ]}
    >
      <Text
        modifiers={[
          font({ weight: "semibold", textStyle: "subheadline" }),
          frame({ maxWidth: largeText ? undefined : FILL, minHeight: ACTION_HEIGHT - 14 }),
          multilineTextAlignment("center"),
        ]}
      >
        {label}
      </Text>
    </Button>
  );
}

/** The column of buttons under a state's text. */
export function StateActions({ children, top = 20 }: { children: ReactNode; top?: number }) {
  return (
    <VStack spacing={10} modifiers={[padding({ top })]}>
      {children}
    </VStack>
  );
}
