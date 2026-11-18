import { createModifier } from "@expo/ui/jetpack-compose/modifiers";

/**
 * Caps the view's width at `fraction` of the width offered. In a Row, a view without `weight`
 * is offered the Row's width, so the cap keeps room for its weighted siblings.
 */
export const maxWidthFraction = (fraction: number) =>
  createModifier("maxWidthFraction", { fraction });

/** Marks the view as a heading, so TalkBack can move between headings. */
export const heading = () => createModifier("heading", {});
