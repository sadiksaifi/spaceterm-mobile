import type { PrimitiveBaseProps } from "@expo/ui/jetpack-compose";
import { createViewModifierEventListener } from "@expo/ui/jetpack-compose/modifiers";
import { requireNativeView } from "expo";
import type { ReactNode, Ref } from "react";
import type { NativeSyntheticEvent } from "react-native";

export type SearchBarRef = {
  /** Closes the full-screen search at once, without its animation, and ends the search. */
  collapse: () => Promise<void>;
  /**
   * Hides the keyboard, keeps the full-screen search for `delayMs`, then fades it out over what is
   * below it and ends the search.
   */
  fadeOut: (delayMs: number) => Promise<void>;
  /**
   * `false` keeps every touch from the results, for example while a selection leads away. The
   * results take touches again when search ends.
   */
  setResultsEnabled: (enabled: boolean) => Promise<void>;
};

export type SearchBarProps = PrimitiveBaseProps & {
  ref?: Ref<SearchBarRef>;
  /** Called with the query on every change, and with "" when search ends. */
  onQueryChange?: (query: string) => void;
  /**
   * Called when the full-screen search opens or closes. It is a window of its own, above the
   * page, so a view meant to show over it belongs in `SearchBar.Results` while it is open.
   */
  onExpandedChange?: (expanded: boolean) => void;
  /** The accessibility label of the expanded bar's back button. */
  backLabel: string;
  /** The accessibility label of the expanded bar's clear button. */
  clearLabel: string;
  /** `SearchBar.Placeholder`, `SearchBar.TrailingIcon` and `SearchBar.Results`. */
  children?: ReactNode;
};

type NativeSearchBarProps = Omit<SearchBarProps, "onQueryChange" | "onExpandedChange"> & {
  onQueryChange?: (event: NativeSyntheticEvent<{ value: string }>) => void;
  onExpandedChange?: (event: NativeSyntheticEvent<{ value: boolean }>) => void;
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
export function SearchBar({
  modifiers,
  onQueryChange,
  onExpandedChange,
  children,
  ...props
}: SearchBarProps) {
  return (
    <NativeSearchBar
      {...props}
      modifiers={modifiers}
      {...(modifiers ? createViewModifierEventListener(modifiers) : undefined)}
      onQueryChange={(event) => onQueryChange?.(event.nativeEvent.value)}
      onExpandedChange={(event) => onExpandedChange?.(event.nativeEvent.value)}
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
