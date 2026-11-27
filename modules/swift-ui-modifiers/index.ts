import { createModifier } from "@expo/ui/swift-ui/modifiers";
import { NativeModule, requireNativeModule } from "expo";
import { useEffect, useId, useRef } from "react";

type Direction = "left" | "right";

type Events = { onHorizontalSwipe(event: { id: string; direction: Direction }): void };

declare class SwiftUIModifiersModule extends NativeModule<Events> {}

const module = requireNativeModule<SwiftUIModifiersModule>("SpaceTermSwiftUIModifiers");

/**
 * Fades the view's content to transparent over `start` and `end` points at its leading and
 * trailing sides, which follow the layout direction.
 */
export const fadingEdges = ({ start, end }: { start: number; end: number }) =>
  createModifier("fadingEdges", { start, end });

/**
 * A modifier that calls `onSwipe` when a sideways drag of at least `distance` points ends. A
 * finger that moves takes the touch from the buttons inside; a tap or a touch and hold stays
 * theirs.
 */
export function useHorizontalSwipe(distance: number, onSwipe: (direction: Direction) => void) {
  const id = useId();
  const latest = useRef(onSwipe);
  useEffect(() => {
    latest.current = onSwipe;
  });
  useEffect(() => {
    const subscription = module.addListener("onHorizontalSwipe", (event) => {
      if (event.id === id) latest.current(event.direction);
    });
    return () => subscription.remove();
  }, [id]);
  return createModifier("horizontalSwipe", { id, distance });
}
