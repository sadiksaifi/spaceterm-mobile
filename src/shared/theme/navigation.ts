import { DarkTheme, DefaultTheme, type Theme } from "expo-router";
import { useColorScheme } from "react-native";

import { useColors } from "./colors";

/** Headers and screen backgrounds in the app's color roles. */
export function useNavigationTheme(): Theme {
  const colors = useColors();
  return {
    ...(useColorScheme() === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      primary: colors.tint,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.separator,
      notification: colors.error,
    },
  };
}
