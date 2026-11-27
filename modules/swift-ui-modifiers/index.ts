import { createModifier } from "@expo/ui/swift-ui/modifiers";

/**
 * Fades the view's content to transparent over `start` and `end` points at its leading and
 * trailing sides, which follow the layout direction.
 */
export const fadingEdges = ({ start, end }: { start: number; end: number }) =>
  createModifier("fadingEdges", { start, end });
