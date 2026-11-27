import { createModifier } from "@expo/ui/jetpack-compose/modifiers";

/**
 * Caps the view's width at `fraction` of the width offered. In a Row, a view without `weight`
 * is offered the Row's width, so the cap keeps room for its weighted siblings.
 */
export const maxWidthFraction = (fraction: number) =>
  createModifier("maxWidthFraction", { fraction });

/**
 * In a Row or Column, the view takes the space its siblings leave, and no more than it needs. A
 * long text then shortens instead of pushing the views after it out.
 */
export const flexible = () => createModifier("flexible", {});

/** Marks the view as a heading, so TalkBack can move between headings. */
export const heading = () => createModifier("heading", {});

/** Hides the view and its content from TalkBack, for a view that only shows what its parent says. */
export const hiddenFromAccessibility = () => createModifier("hiddenFromAccessibility", {});

/**
 * Reports the view to TalkBack as a radio button, selected or not, for a row that chooses on a
 * tap and also takes touch and hold, which Expo UI's `selectable` leaves out.
 */
export const radioSelected = (selected: boolean) => createModifier("radioSelected", { selected });

/** Reports the view to TalkBack as disabled, for a dimmed row that takes no taps. */
export const disabled = () => createModifier("disabled", {});

/** Padding on the screen's left and right in both directions, for content that stays left to right. */
export const absolutePadding = (left: number, top: number, right: number, bottom: number) =>
  createModifier("absolutePadding", { left, top, right, bottom });
