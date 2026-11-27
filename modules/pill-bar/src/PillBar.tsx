import type { CommonViewModifierProps } from "@expo/ui/swift-ui";
import { createViewModifierEventListener } from "@expo/ui/swift-ui/modifiers";
import { requireNativeView } from "expo";

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

export type PillBarProps = CommonViewModifierProps & {
  pills: readonly Pill[];
  selected: string;
  /** A tap or a drag picked the pill `key`. */
  onSelect: (key: string) => void;
  onAction: (key: string, action: string) => void;
};

type NativeProps = CommonViewModifierProps & {
  pills: readonly Pill[];
  selected: string;
  onSelect: (event: { nativeEvent: { key: string } }) => void;
  onAction: (event: { nativeEvent: { key: string; action: string } }) => void;
};

const NativePillBar = requireNativeView<NativeProps>("SpaceTermPillBar", "PillBarView");

/**
 * Pills in a glass capsule with one highlighted, for SwiftUI inside an Expo UI `Host`. The pills
 * share the width when every name fits, and scroll otherwise. A tap or a drag of the highlight
 * picks a pill; touch and hold opens its menu.
 */
export function PillBar({ modifiers, onSelect, onAction, ...rest }: PillBarProps) {
  return (
    <NativePillBar
      modifiers={modifiers}
      {...(modifiers ? createViewModifierEventListener(modifiers) : undefined)}
      {...rest}
      onSelect={({ nativeEvent }) => onSelect(nativeEvent.key)}
      onAction={({ nativeEvent }) => onAction(nativeEvent.key, nativeEvent.action)}
    />
  );
}
