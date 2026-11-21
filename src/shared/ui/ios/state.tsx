import { Button, Image, Text } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityHidden,
  buttonBorderShape,
  buttonStyle,
  disabled,
  font,
  frame,
  multilineTextAlignment,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import type { ComponentProps, ReactNode } from "react";
import { useWindowDimensions } from "react-native";

import { useLargeText } from "../large-text";
import { secondary } from "./modifiers";

/** Empty-state metrics from the mockups. */
const ICON_SIZE = 48;
const ACTION_WIDTH = 230;
export const ACTION_HEIGHT = 34;
/** How much the Large Title style grows at the largest Dynamic Type size; the icon grows as much. */
const MAX_ICON_SCALE = 1.76;
/** Lets a frame take all the space its container offers, like SwiftUI's `.infinity`. */
const FILL = Number.POSITIVE_INFINITY;

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

/** A state's sentence. `top` is the space above it: more for a second paragraph. */
export function StateBody({ children, top = 6 }: { children: ReactNode; top?: number }) {
  return (
    <Text
      modifiers={[
        font({ textStyle: "callout" }),
        secondary,
        multilineTextAlignment("center"),
        padding({ top }),
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * A capsule button of an empty state: filled blue when prominent, gray otherwise. It has the
 * mockup's width, or fits its label with `fitsLabel`. At accessibility text sizes it grows with
 * its label instead of truncating it.
 */
export function ActionButton({
  label,
  onPress,
  prominent = false,
  fitsLabel = false,
}: {
  label: string;
  onPress: (() => void) | undefined;
  prominent?: boolean;
  fitsLabel?: boolean;
}) {
  const largeText = useLargeText();
  // Fixed: the mockup's width. Grows: at least that wide, wider for a long label. Fits: the label's.
  const width = fitsLabel
    ? []
    : [largeText ? frame({ minWidth: ACTION_WIDTH }) : frame({ width: ACTION_WIDTH })];
  const fixed = !fitsLabel && !largeText;
  return (
    <Button
      onPress={onPress}
      modifiers={[
        buttonStyle(prominent ? "borderedProminent" : "bordered"),
        buttonBorderShape("capsule"),
        ...width,
        disabled(!onPress),
      ]}
    >
      <Text
        modifiers={[
          font({ weight: "semibold", textStyle: "subheadline" }),
          frame({ maxWidth: fixed ? FILL : undefined, minHeight: ACTION_HEIGHT - 14 }),
          multilineTextAlignment("center"),
        ]}
      >
        {label}
      </Text>
    </Button>
  );
}
