import type { CommonViewModifierProps } from "@expo/ui/swift-ui";
import { createViewModifierEventListener } from "@expo/ui/swift-ui/modifiers";
import { requireNativeView } from "expo";
import type { ReactNode } from "react";

/** An entry of a pill's menu. */
export type PillAction = {
  id: string;
  label: string;
  /** An SF Symbol. */
  systemImage: string;
  destructive?: boolean;
  disabled?: boolean;
  /** A divider goes above it. */
  divided?: boolean;
};

export type Pill = { key: string; name: string; actions: readonly PillAction[] };

/** A round glass button beside the pills. */
export type BarButton = {
  /** An SF Symbol. */
  systemImage: string;
  label: string;
  onPress: () => void;
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
   * The pills' pages, one SwiftUI view per pill in the pills' order. The bar then sits over them
   * at the bottom, and a drag of the highlight slides them with it.
   */
  children?: ReactNode;
  /** A tap or a drag picked the pill `key`. */
  onSelect: (key: string) => void;
  onAction: (key: string, action: string) => void;
};

type NativeProps = CommonViewModifierProps & {
  pills: readonly Pill[];
  selected: string;
  leading?: Omit<BarButton, "onPress">;
  trailing?: Omit<BarButton, "onPress">;
  bottom?: number;
  side?: number;
  children?: ReactNode;
  onSelect: (event: { nativeEvent: { key: string } }) => void;
  onAction: (event: { nativeEvent: { key: string; action: string } }) => void;
  onLeading: () => void;
  onTrailing: () => void;
};

const NativePillBar = requireNativeView<NativeProps>("SpaceTermPillBar", "PillBarView");

/**
 * Pills in a glass capsule with one highlighted, between optional round buttons, for SwiftUI
 * inside an Expo UI `Host`. The pills share the width when every name fits, and scroll otherwise.
 * A tap or a drag of the highlight picks a pill; touch and hold opens its menu. While the
 * highlight is held, the capsule takes the buttons' room. With pages as children, the page of the
 * highlighted pill fills the view, and a drag slides the next page in under the finger.
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
      leading={leading && { systemImage: leading.systemImage, label: leading.label }}
      trailing={trailing && { systemImage: trailing.systemImage, label: trailing.label }}
      onSelect={({ nativeEvent }) => onSelect(nativeEvent.key)}
      onAction={({ nativeEvent }) => onAction(nativeEvent.key, nativeEvent.action)}
      onLeading={() => leading?.onPress()}
      onTrailing={() => trailing?.onPress()}
    />
  );
}
