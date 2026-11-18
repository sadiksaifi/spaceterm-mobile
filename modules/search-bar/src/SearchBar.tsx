import type { PrimitiveBaseProps } from "@expo/ui/jetpack-compose";
import { createViewModifierEventListener } from "@expo/ui/jetpack-compose/modifiers";
import { requireNativeView } from "expo";
import type { ReactNode } from "react";
import type { NativeSyntheticEvent } from "react-native";

export type SearchBarProps = PrimitiveBaseProps & {
  /** Called with the query on every change, and with "" when search ends. */
  onQueryChange?: (query: string) => void;
  /** The accessibility label of the expanded bar's back button. */
  backLabel: string;
  /** The accessibility label of the expanded bar's clear button. */
  clearLabel: string;
  /** `SearchBar.Placeholder`, `SearchBar.TrailingIcon` and `SearchBar.Results`. */
  children?: ReactNode;
};

type NativeSearchBarProps = Omit<SearchBarProps, "onQueryChange"> & {
  onQueryChange?: (event: NativeSyntheticEvent<{ value: string }>) => void;
};

const NativeSearchBar = requireNativeView<NativeSearchBarProps>(
  "SpaceTermSearchBar",
  "SearchBarView",
);

const NativeSlot = requireNativeView<{ slotName: string; children: ReactNode }>(
  "ExpoUI",
  "SlotView",
);

/**
 * Material 3's search bar: a pill that opens a full-screen search. Children are Expo UI
 * Jetpack Compose views, so it goes inside a `Host`.
 */
export function SearchBar({ modifiers, onQueryChange, children, ...props }: SearchBarProps) {
  return (
    <NativeSearchBar
      {...props}
      modifiers={modifiers}
      {...(modifiers ? createViewModifierEventListener(modifiers) : undefined)}
      onQueryChange={(event) => onQueryChange?.(event.nativeEvent.value)}
    >
      {children}
    </NativeSearchBar>
  );
}

/** The text the bar shows while the query is empty. */
SearchBar.Placeholder = function Placeholder({ children }: { children: ReactNode }) {
  return <NativeSlot slotName="placeholder">{children}</NativeSlot>;
};

/** The action at the end of the collapsed bar. The expanded bar shows its clear button there. */
SearchBar.TrailingIcon = function TrailingIcon({ children }: { children: ReactNode }) {
  return <NativeSlot slotName="trailingIcon">{children}</NativeSlot>;
};

/** What the full-screen search shows below its field. */
SearchBar.Results = function Results({ children }: { children: ReactNode }) {
  return <NativeSlot slotName="results">{children}</NativeSlot>;
};
