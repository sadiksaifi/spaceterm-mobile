import type { CommonViewModifierProps } from "@expo/ui/swift-ui";
import { createViewModifierEventListener } from "@expo/ui/swift-ui/modifiers";
import { requireNativeView } from "expo";
import type { ReactNode } from "react";

/** An entry of a pill's menu or a button's menu. */
export type PillAction = {
  id: string;
  label: string;
  /** An SF Symbol. */
  systemImage?: string;
  destructive?: boolean;
  disabled?: boolean;
  /** A divider goes above it. */
  divided?: boolean;
  /** Present for one of a set of choices, which the menu shows with a check while true. */
  checked?: boolean;
};

export type Pill = { key: string; name: string; actions: readonly PillAction[] };

/** A round glass button beside the pills, which acts on a tap or opens its menu. */
export type BarButton = {
  /** An SF Symbol. */
  systemImage: string;
  label: string;
  disabled?: boolean;
} & (
  | { onPress: () => void; menu?: never; onAction?: never }
  | { menu: readonly PillAction[]; onAction: (action: string) => void; onPress?: never }
);

type NativeButton = Pick<BarButton, "systemImage" | "label" | "disabled"> & {
  menu?: readonly PillAction[];
};

export type PillBarProps = CommonViewModifierProps & {
  pills: readonly Pill[];
  selected: string;
  leading?: BarButton;
  trailing?: BarButton;
  /** The bar's distance from the bottom edge and from the sides. */
  bottom?: number;
  side?: number;
  /**
   * The selected pill's content, as SwiftUI views. The bar then sits over it at the bottom, and
   * a change of selection brings it in from the side of the newly selected pill.
   */
  children?: ReactNode;
  /** A tap or a drag picked the pill `key`. */
  onSelect: (key: string) => void;
  onAction: (key: string, action: string) => void;
};

type NativeProps = CommonViewModifierProps & {
  pills: readonly Pill[];
  selected: string;
  leading?: NativeButton;
  trailing?: NativeButton;
  bottom?: number;
  side?: number;
  children?: ReactNode;
  onSelect: (event: { nativeEvent: { key: string } }) => void;
  onAction: (event: { nativeEvent: { key: string; action: string } }) => void;
  onLeading: () => void;
  onTrailing: () => void;
  onLeadingAction: (event: { nativeEvent: { action: string } }) => void;
  onTrailingAction: (event: { nativeEvent: { action: string } }) => void;
};

const NativePillBar = requireNativeView<NativeProps>("SpaceTermPillBar", "PillBarView");

/**
 * Pills in a glass capsule with one highlighted, between optional round buttons, for SwiftUI
 * inside an Expo UI `Host`. The pills share the width when every name fits, and scroll otherwise.
 * A tap or a drag of the highlight picks a pill; touch and hold opens its menu. While the
 * highlight is held, the capsule takes the buttons' room. Content given as children shows under
 * the bar and comes in from the side of a newly selected pill.
 */
export function PillBar({
  modifiers,
  leading,
  trailing,
  onSelect,
  onAction,
  ...rest
}: PillBarProps) {
  return (
    <NativePillBar
      modifiers={modifiers}
      {...(modifiers ? createViewModifierEventListener(modifiers) : undefined)}
      {...rest}
      leading={leading && native(leading)}
      trailing={trailing && native(trailing)}
      onSelect={({ nativeEvent }) => onSelect(nativeEvent.key)}
      onAction={({ nativeEvent }) => onAction(nativeEvent.key, nativeEvent.action)}
      onLeading={() => leading?.onPress?.()}
      onTrailing={() => trailing?.onPress?.()}
      onLeadingAction={({ nativeEvent }) => leading?.onAction?.(nativeEvent.action)}
      onTrailingAction={({ nativeEvent }) => trailing?.onAction?.(nativeEvent.action)}
    />
  );
}

/** The button without its callbacks, which the native view cannot take. */
function native({ systemImage, label, disabled, menu }: BarButton): NativeButton {
  return { systemImage, label, disabled, menu };
}
