import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { useNavigationTheme } from "@/shared/theme/navigation";

export default function RootLayout() {
  return (
    <ThemeProvider value={useNavigationTheme()}>
      <Stack />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
