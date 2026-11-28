import { requireNativeView } from "expo";
import { StyleSheet, type ViewProps } from "react-native";

const NativeSubtitle = requireNativeView<ViewProps & { text: string | null }>(
  "SpaceTermNavigationSubtitle",
);

/**
 * Sets the iOS navigation bar subtitle of the screen it is rendered in, under the title. `null`
 * shows none. It takes no space and draws nothing.
 */
export function NavigationSubtitle({ text }: { text: string | null }) {
  return <NativeSubtitle text={text} pointerEvents="none" style={styles.none} />;
}

const styles = StyleSheet.create({
  none: { position: "absolute", width: 0, height: 0 },
});
