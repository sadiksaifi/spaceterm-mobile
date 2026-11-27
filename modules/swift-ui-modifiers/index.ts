import { createModifier } from "@expo/ui/swift-ui/modifiers";

/** Fades the view's content to transparent over `left` and `right` points at its sides. */
export const fadingEdges = ({ left, right }: { left: number; right: number }) =>
  createModifier("fadingEdges", { left, right });
