import { ScrollView, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, frame, padding } from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";
import type { ColorValue } from "react-native";

import { useLargeText } from "@/shared/ui/large-text";

/** Home's states sit above center, clear of the bottom toolbar. */
const BOTTOM_INSET = 96;
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

/** A name inside a sentence, such as a button's label, in semibold and the text color. */
export function nameText(name: string, color: ColorValue) {
  return (
    <Text
      modifiers={[
        font({ textStyle: "callout", weight: "semibold" }),
        foregroundStyle({ type: "color", color }),
      ]}
    >
      {name}
    </Text>
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
