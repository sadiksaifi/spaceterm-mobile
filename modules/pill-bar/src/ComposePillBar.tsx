import type { PrimitiveBaseProps } from "@expo/ui/jetpack-compose";
import { createViewModifierEventListener } from "@expo/ui/jetpack-compose/modifiers";
import { requireNativeView } from "expo";
import type { ReactNode } from "react";

/** An entry of a pill's menu. */
export type PillAction = {
  id: string;
  label: string;
  disabled?: boolean;
  /** A divider goes above it. */
  divided?: boolean;
};

export type Pill = { key: string; name: string; actions: readonly PillAction[] };

export type PillBarProps = PrimitiveBaseProps & {
  pills: readonly Pill[];
  selected: string;
  /** The bar's distance from the bottom edge and from the sides. */
  bottom?: number;
  side?: number;
  /** `PillBar.Leading`, `PillBar.Trailing`, and `PillBar.Content`. */
  children?: ReactNode;
  /** A tap or a drag picked the pill `key`. */
  onSelect: (key: string) => void;
  onAction: (key: string, action: string) => void;
};

type NativeProps = Omit<PillBarProps, "onSelect" | "onAction"> & {
  onPillSelect: (event: { nativeEvent: { key: string } }) => void;
  onPillAction: (event: { nativeEvent: { key: string; action: string } }) => void;
};

const NativePillBar = requireNativeView<NativeProps>("SpaceTermPillBar", "PillBarView");

const NativeSlot = requireNativeView<{ slotName: string; children: ReactNode }>(
  "ExpoUI",
  "SlotView",
);

/**
 * Pills in a capsule with the selected one on an indicator, between the leading and trailing
 * views, for Jetpack Compose inside an Expo UI `Host`. The pills share the width when every name
 * fits, and scroll by themselves otherwise. A tap or a sideways drag of the indicator picks a
 * pill; touch and hold opens its menu. Content shows under the bar and comes in from the side of
 * a newly selected pill.
 */
export function PillBar({ modifiers, onSelect, onAction, ...rest }: PillBarProps) {
  return (
    <NativePillBar
      modifiers={modifiers}
      {...(modifiers ? createViewModifierEventListener(modifiers) : undefined)}
      {...rest}
      onPillSelect={({ nativeEvent }) => onSelect(nativeEvent.key)}
      onPillAction={({ nativeEvent }) => onAction(nativeEvent.key, nativeEvent.action)}
    />
  );
}

/** The view at the start of the bar. */
PillBar.Leading = function Leading({ children }: { children: ReactNode }) {
  return <NativeSlot slotName="leading">{children}</NativeSlot>;
};

/** The view at the end of the bar. */
PillBar.Trailing = function Trailing({ children }: { children: ReactNode }) {
  return <NativeSlot slotName="trailing">{children}</NativeSlot>;
};

/** The selected pill's content, under the bar. */
PillBar.Content = function Content({ children }: { children: ReactNode }) {
  return <NativeSlot slotName="content">{children}</NativeSlot>;
};
