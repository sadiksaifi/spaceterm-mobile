import { Button, Image, Text, VStack } from "@expo/ui/swift-ui";
import {
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
import type { ColorValue } from "react-native";

import { secondary } from "../modifiers";

/** Empty-state metrics from the mockups. */
const ACTION_WIDTH = 230;
export const ACTION_HEIGHT = 34;
/** Empty states sit above center, clear of the bottom toolbar. */
const BOTTOM_INSET = 96;
/** Lets a frame take all the space its container offers, like SwiftUI's `.infinity`. */
const FILL = Number.POSITIVE_INFINITY;

/** Fills the screen and centers its content above the bottom toolbar. */
export function Centered({
  children,
  extraBottom = 0,
}: {
  children: ReactNode;
  extraBottom?: number;
}) {
  return (
    <VStack
      spacing={0}
      modifiers={[
        padding({ leading: 40, trailing: 40, bottom: BOTTOM_INSET + extraBottom }),
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
  return (
    <Image
      systemName={systemName}
      modifiers={[font({ size: 48 }), secondary, padding({ bottom: 14 })]}
    />
  );
}

export function StateTitle({ children }: { children: string }) {
  return (
    <Text
      modifiers={[font({ textStyle: "title2", weight: "bold" }), multilineTextAlignment("center")]}
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

/** A capsule button of an empty state: filled blue when prominent, gray otherwise. */
export function ActionButton({
  label,
  onPress,
  prominent = false,
}: {
  label: string;
  onPress: (() => void) | undefined;
  prominent?: boolean;
}) {
  return (
    <Button
      onPress={onPress}
      modifiers={[
        buttonStyle(prominent ? "borderedProminent" : "bordered"),
        buttonBorderShape("capsule"),
        frame({ width: ACTION_WIDTH }),
        disabled(!onPress),
      ]}
    >
      <Text
        modifiers={[
          font({ weight: "semibold", textStyle: "subheadline" }),
          frame({ maxWidth: FILL, minHeight: ACTION_HEIGHT - 14 }),
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
