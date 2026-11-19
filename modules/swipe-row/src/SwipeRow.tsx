import type { PrimitiveBaseProps } from "@expo/ui/jetpack-compose";
import { createViewModifierEventListener } from "@expo/ui/jetpack-compose/modifiers";
import { requireNativeView } from "expo";
import type { ReactNode } from "react";

export type SwipeRowProps = PrimitiveBaseProps & {
  /** A row that is off does not move. @default true */
  enabled?: boolean;
  /** Called when a swipe from the end side passes the threshold. The row stays aside. */
  onSwipe?: () => void;
  /** Each new value puts a swiped row back. */
  resetToken?: number;
  /** `SwipeRow.Background` and `SwipeRow.Content`. */
  children?: ReactNode;
};

const NativeSwipeRow = requireNativeView<SwipeRowProps>("SpaceTermSwipeRow", "SwipeRowView");

const NativeSlot = requireNativeView<{ slotName: string; children: ReactNode }>(
  "ExpoUI",
  "SlotView",
);

/**
 * A row that swipes from its end side to reveal what is behind it, Material 3's swipe to dismiss.
 * Children are Expo UI Jetpack Compose views, so it goes inside a `Host`.
 */
export function SwipeRow({ modifiers, children, ...props }: SwipeRowProps) {
  return (
    <NativeSwipeRow
      {...props}
      modifiers={modifiers}
      {...(modifiers ? createViewModifierEventListener(modifiers) : undefined)}
    >
      {children}
    </NativeSwipeRow>
  );
}

/** What the swipe reveals, behind the row. */
SwipeRow.Background = function Background({ children }: { children: ReactNode }) {
  return <NativeSlot slotName="background">{children}</NativeSlot>;
};

/** The row itself. */
SwipeRow.Content = function Content({ children }: { children: ReactNode }) {
  return <NativeSlot slotName="content">{children}</NativeSlot>;
};
